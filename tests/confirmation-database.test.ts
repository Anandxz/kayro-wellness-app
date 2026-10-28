import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

type Row = {
  id: string;
  starts_at: Date;
  status: string;
  client_confirmed_at: Date | null;
  reminder_dismissed_at: Date | null;
  cancelled_at: Date | null;
};
test("confirmation/reminder SQL and complete appointment lifecycle", async (t) => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    for (const file of [
      "202610280001_appointments.sql",
      "202610280002_sample_data.sql",
      "202610280003_client_confirmation.sql",
      "202610280004_revision_guards.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    const workspace = crypto.randomUUID(),
      other = crypto.randomUUID();
    await db.query("select create_demo_workspace($1)", [workspace]);
    await db.query("select create_demo_workspace($1)", [other]);
    const originals = (
      await db.query(
        "select id,client_name,phone,starts_at,status,client_confirmed_at,reminder_dismissed_at from appointments where workspace_id=$1 order by seed_key",
        [workspace],
      )
    ).rows;
    const { rows: days } = await db.query<{ day: string }>(
      "select to_char(d, 'YYYY-MM-DD') as day from generate_series((now() at time zone 'Asia/Kolkata')::date+1, (now() at time zone 'Asia/Kolkata')::date+7, interval '1 day') d where extract(dow from d) <> 0 order by d limit 1",
    );
    const time = (hour: string) => `${days[0].day}T${hour}:00+05:30`;
    const read = async (id: string) =>
      (
        await db.query<Row>(
          "select * from appointments where workspace_id=$1 and id=$2",
          [workspace, id],
        )
      ).rows[0];
    const book = async (hour: string) =>
      (
        await db.query<Row>(
          "select * from mutate_appointment($1,'book',p_name=>'Lifecycle Client',p_phone=>'+919820099999',p_service=>'follow-up',p_starts=>$2)",
          [workspace, time(hour)],
        )
      ).rows[0];
    const confirm = async (row: Row) =>
      (
        await db.query<Row>(
          "select * from mutate_appointment($1,'confirm',p_id=>$2,p_starts=>$3)",
          [workspace, row.id, row.starts_at],
        )
      ).rows[0];
    let first: Row, second: Row;
    await t.test(
      "booking starts awaiting confirmation; repeated confirmation persists without changing Booked",
      async () => {
        first = await book("09:00");
        second = await book("10:00");
        assert.equal(first.client_confirmed_at, null);
        first = await confirm(first);
        assert.ok(first.client_confirmed_at);
        assert.equal(first.status, "Booked");
        const originalTimestamp = first.client_confirmed_at!.getTime();
        const repeat = await confirm(first);
        assert.equal(repeat.client_confirmed_at!.getTime(), originalTimestamp);
        assert.equal(
          (await read(first.id)).client_confirmed_at!.getTime(),
          originalTimestamp,
        );
        assert.equal((await read(second.id)).client_confirmed_at, null);
      },
    );
    await t.test(
      "failed reschedule retains confirmation; successful move resets it and releases old slot",
      async () => {
        await assert.rejects(
          () =>
            db.query(
              "select * from mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
              [workspace, first.id, second.starts_at],
            ),
          { code: "23P01" },
        );
        assert.ok((await read(first.id)).client_confirmed_at);
        const old = first;
        await db.query(
          "select * from mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
          [workspace, first.id, time("11:00")],
        );
        first = await read(first.id);
        assert.equal(first.client_confirmed_at, null);
        assert.equal(first.reminder_dismissed_at, null);
        await assert.rejects(
          () => confirm(old),
          /appointment time has changed/,
        );
        await book("09:00");
        first = await confirm(first);
        assert.ok(first.client_confirmed_at);
      },
    );
    await t.test(
      "confirmed appointment cancellation clears intent, releases slot and rejects further confirmation",
      async () => {
        await db.query(
          "select * from mutate_appointment($1,'cancel',p_id=>$2)",
          [workspace, first.id],
        );
        const cancelled = await read(first.id);
        assert.equal(cancelled.status, "Booked");
        assert.ok(cancelled.cancelled_at);
        assert.equal(cancelled.client_confirmed_at, null);
        await assert.rejects(() => confirm(cancelled), /Only upcoming/);
        await book("11:00");
      },
    );
    await t.test(
      "reminder dismissal persists independently of attendance and confirmation",
      async () => {
        // Synthetic near-time record isolates the 24h rule even on weekends.
        const due = (
          await db.query<Row>(
            "insert into appointments (workspace_id,client_name,phone,service_id,starts_at,ends_at) values ($1,'Reminder Client',null,'follow-up',now()+interval '1 hour',now()+interval '90 minutes') returning *",
            [workspace],
          )
        ).rows[0];
        await db.query(
          "select * from mutate_appointment($1,'dismiss-reminder',p_id=>$2,p_starts=>$3)",
          [workspace, due.id, due.starts_at],
        );
        assert.ok((await read(due.id)).reminder_dismissed_at);
        assert.equal((await read(due.id)).client_confirmed_at, null);
        assert.equal((await read(due.id)).status, "Booked");
        assert.ok((await confirm(due)).client_confirmed_at);
        await db.query(
          "select * from mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
          [workspace, due.id, time("14:00")],
        );
        assert.equal((await read(due.id)).reminder_dismissed_at, null);
        assert.equal((await read(due.id)).client_confirmed_at, null);
      },
    );
    await t.test(
      "completion and no-show are independent of confirmed intent; past actions are rejected",
      async () => {
        // Simulate elapsed time on NEW test rows only. Production exposes no clock
        // override or direct timestamp-edit endpoint; assignment samples are untouched.
        for (const [hour, attendance] of [
          ["15:00", "Done"],
          ["16:00", "No-show"],
        ]) {
          let row = await book(hour);
          row = await confirm(row);
          await db.query(
            "update appointments set starts_at=starts_at-interval '8 days',ends_at=ends_at-interval '8 days' where id=$1",
            [row.id],
          );
          // Preserve intent history while simulating passage of time in the fixture.
          await db.query(
            "update appointments set client_confirmed_at=now()-interval '9 days' where id=$1",
            [row.id],
          );
          const past = await read(row.id);
          await assert.rejects(() => confirm(past), /Only upcoming/);
          await assert.rejects(
            () =>
              db.query(
                "select * from mutate_appointment($1,'cancel',p_id=>$2)",
                [workspace, row.id],
              ),
            /Past appointments/,
          );
          await db.query(
            "select * from mutate_appointment($1,'status',p_id=>$2,p_status=>$3)",
            [workspace, row.id, attendance],
          );
          const saved = await read(row.id);
          assert.equal(saved.status, attendance);
          assert.ok(saved.client_confirmed_at);
          await assert.rejects(() => confirm(saved), /Only upcoming/);
        }
      },
    );
    await t.test(
      "workspace scope and restricted functions also apply to confirmation",
      async () => {
        await assert.rejects(
          () =>
            db.query(
              "select * from mutate_appointment($1,'confirm',p_id=>$2,p_starts=>$3)",
              [other, second.id, second.starts_at],
            ),
          { code: "P0002" },
        );
        await db.exec("set role anon");
        await assert.rejects(
          () =>
            db.query(
              "select * from mutate_appointment($1,'confirm',p_id=>$2,p_starts=>$3)",
              [workspace, second.id, second.starts_at],
            ),
          { code: "42501" },
        );
        await db.exec("reset role; set role service_role");
        await assert.rejects(
          () =>
            db.query(
              "select * from mutate_appointment_base($1,'cancel',p_id=>$2)",
              [workspace, second.id],
            ),
          { code: "42501" },
        );
        await db.exec("reset role");
      },
    );
    await t.test(
      "all original sample rows remain intact after the lifecycle",
      async () => {
        const after = (
          await db.query(
            "select id,client_name,phone,starts_at,status,client_confirmed_at,reminder_dismissed_at from appointments where workspace_id=$1 and seed_key is not null order by seed_key",
            [workspace],
          )
        ).rows;
        assert.deepEqual(after, originals);
      },
    );
  } finally {
    await db.close();
  }
});
