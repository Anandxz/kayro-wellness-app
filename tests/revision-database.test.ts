import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
type Row = {
  id: string;
  revision: string;
  starts_at: Date;
  status: string;
  cancelled_at: Date | null;
  client_confirmed_at: Date | null;
};
test("guarded service-role RPC: lifecycle, stale revisions and visitor boundaries", async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    const workspace = crypto.randomUUID(),
      other = crypto.randomUUID();
    await db.query("select create_demo_workspace($1)", [workspace]);
    await db.query("select create_demo_workspace($1)", [other]);
    const { rows: days } = await db.query<{ day: string }>(
      "select to_char(d, 'YYYY-MM-DD') as day from generate_series((now() at time zone 'Asia/Kolkata')::date+1,(now() at time zone 'Asia/Kolkata')::date+7,interval '1 day') d where extract(dow from d) <> 0 order by d limit 1",
    );
    const start = `${days[0].day}T10:00:00+05:30`,
      moved = `${days[0].day}T11:00:00+05:30`;
    await db.exec("set role service_role");
    const created = (
      await db.query<Row>(
        "select * from mutate_appointment_checked($1,'book',p_name=>'Revision Client',p_phone=>'+919820099999',p_service=>'follow-up',p_starts=>$2)",
        [workspace, start],
      )
    ).rows[0];
    assert.ok(created.revision);
    await assert.rejects(
      () =>
        db.query("select * from mutate_appointment($1,'cancel',p_id=>$2)", [
          workspace,
          created.id,
        ]),
      { code: "42501" },
    );
    await assert.rejects(
      () =>
        db.query(
          "select * from mutate_appointment_checked($1,'cancel',p_id=>$2)",
          [workspace, created.id],
        ),
      { code: "40001" },
    );
    await assert.rejects(
      () =>
        db.query(
          "select * from mutate_appointment_checked($1,'cancel',p_id=>$2,p_expected_revision=>$3)",
          [other, created.id, created.revision],
        ),
      { code: "P0002" },
    );
    const confirmed = (
      await db.query<Row>(
        "select * from mutate_appointment_checked($1,'confirm',p_id=>$2,p_expected_revision=>$3,p_starts=>$4)",
        [workspace, created.id, created.revision, start],
      )
    ).rows[0];
    assert.ok(confirmed.client_confirmed_at);
    assert.notEqual(confirmed.revision, created.revision);
    await assert.rejects(
      () =>
        db.query(
          "select * from mutate_appointment_checked($1,'cancel',p_id=>$2,p_expected_revision=>$3)",
          [workspace, created.id, created.revision],
        ),
      { code: "40001" },
    );
    const rescheduled = (
      await db.query<Row>(
        "select * from mutate_appointment_checked($1,'reschedule',p_id=>$2,p_expected_revision=>$3,p_starts=>$4)",
        [workspace, created.id, confirmed.revision, moved],
      )
    ).rows[0];
    assert.equal(rescheduled.id, created.id);
    assert.equal(rescheduled.client_confirmed_at, null);
    await assert.rejects(
      () =>
        db.query(
          "select * from mutate_appointment_checked($1,'reschedule',p_id=>$2,p_expected_revision=>$3,p_starts=>$4)",
          [workspace, created.id, confirmed.revision, start],
        ),
      { code: "40001" },
    );
    const cancelled = (
      await db.query<Row>(
        "select * from mutate_appointment_checked($1,'cancel',p_id=>$2,p_expected_revision=>$3)",
        [workspace, created.id, rescheduled.revision],
      )
    ).rows[0];
    assert.ok(cancelled.cancelled_at);
    assert.equal(cancelled.status, "Booked");
    await db.query(
      "select * from mutate_appointment_checked($1,'book',p_name=>'Manual Client',p_phone=>'+919820099998',p_service=>'follow-up',p_starts=>$2)",
      [workspace, moved],
    );
    // Dedicated historical fixture exercises persistent attendance without changing seeds.
    await db.exec("reset role");
    const historical = (
      await db.query<Row>(
        "insert into appointments(workspace_id,client_name,service_id,starts_at,ends_at) values($1,'Attendance Fixture','follow-up',now()-interval '8 days',now()-interval '8 days'+interval '30 minutes') returning *",
        [workspace],
      )
    ).rows[0];
    await db.exec("set role service_role");
    const done = (
      await db.query<Row>(
        "select * from mutate_appointment_checked($1,'status',p_id=>$2,p_expected_revision=>$3,p_status=>'Done')",
        [workspace, historical.id, historical.revision],
      )
    ).rows[0];
    assert.equal(done.status, "Done");
    assert.equal(
      (await db.query<Row>("select * from appointments where id=$1", [done.id]))
        .rows[0].status,
      "Done",
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(
      () =>
        db.query(
          "select * from mutate_appointment_checked($1,'cancel',p_id=>$2,p_expected_revision=>$3)",
          [workspace, created.id, cancelled.revision],
        ),
      { code: "42501" },
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
