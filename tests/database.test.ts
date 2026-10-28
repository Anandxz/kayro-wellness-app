import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

test("PostgreSQL migrations, seeds, atomic booking rules and denied public access", async (t) => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    const migration = await readFile(
      "supabase/migrations/202610280001_appointments.sql",
      "utf8",
    );
    const seed = await readFile(
      "supabase/migrations/202610280002_sample_data.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(seed);
    await db.exec(seed);
    await db.exec(
      await readFile(
        "supabase/migrations/202610280003_client_confirmation.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202610280004_revision_guards.sql",
        "utf8",
      ),
    );
    const workspace = crypto.randomUUID();
    const other = crypto.randomUUID();
    await db.query("select public.create_demo_workspace($1)", [workspace]);
    await db.query("select public.create_demo_workspace($1)", [other]);
    const rows = async () =>
      (
        await db.query<{
          id: string;
          status: string;
          cancelled_at: string | null;
          starts_at: Date;
        }>(
          "select * from public.appointments where workspace_id=$1 order by starts_at",
          [workspace],
        )
      ).rows;
    // Relative to the engine's actual clock, not frozen UI fixtures.
    const { rows: dates } = await db.query<{ day: string }>(
      "select to_char(d, 'YYYY-MM-DD') as day from generate_series((now() at time zone 'Asia/Kolkata')::date+1, (now() at time zone 'Asia/Kolkata')::date+7, interval '1 day') d where extract(dow from d) <> 0 order by d limit 1",
    );
    const day = dates[0].day;
    const book = async (time: string, service = "follow-up") =>
      (
        await db.query<{ id: string; starts_at: Date }>(
          "select * from public.mutate_appointment($1,'book',p_name=>'Fictional Client',p_phone=>'+919820099999',p_service=>$2,p_starts=>$3)",
          [workspace, service, `${day}T${time}:00+05:30`],
        )
      ).rows[0];
    await t.test(
      "seed reruns preserve exactly five normalized historical rows per workspace",
      async () => {
        const data = (
          await db.query<{
            client_name: string;
            phone: string | null;
            date: string;
            time: string;
            status: string;
          }>(
            "select client_name,phone,appointment_date::text as date,appointment_time::text as time,status from public.appointments where workspace_id=$1 order by seed_key",
            [workspace],
          )
        ).rows;
        assert.deepEqual(data, [
          {
            client_name: "Riya Shah",
            phone: "+919820011111",
            date: "2026-10-24",
            time: "10:00:00",
            status: "Booked",
          },
          {
            client_name: "Arjun Mehta",
            phone: "+919820022222",
            date: "2026-10-24",
            time: "11:30:00",
            status: "Booked",
          },
          {
            client_name: "Riya Shah",
            phone: "+919820011111",
            date: "2026-10-25",
            time: "16:00:00",
            status: "Booked",
          },
          {
            client_name: "Meera Iyer",
            phone: null,
            date: "2026-10-23",
            time: "09:00:00",
            status: "Done",
          },
          {
            client_name: "Kabir Rao",
            phone: "+919820033333",
            date: "2026-10-22",
            time: "14:00:00",
            status: "No-show",
          },
        ]);
      },
    );
    let appointmentId: string;
    await t.test(
      "RPC writes persist and constraint rejects duplicates and partial overlaps",
      async () => {
        appointmentId = (await book("11:00", "initial")).id;
        assert.equal((await rows()).length, 6);
        await assert.rejects(() => book("11:00"), { code: "23P01" });
        await assert.rejects(() => book("11:30"), { code: "23P01" });
        await book("12:00");
      },
    );
    await t.test(
      "reschedule changes the same ID; a failed move preserves its old instant",
      async () => {
        const before = (await rows()).find((a) => a.id === appointmentId)!;
        await assert.rejects(
          () =>
            db.query(
              "select * from public.mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
              [workspace, appointmentId, `${day}T12:00:00+05:30`],
            ),
          { code: "23P01" },
        );
        assert.equal(
          String((await rows()).find((a) => a.id === appointmentId)!.starts_at),
          String(before.starts_at),
        );
        await db.query(
          "select * from public.mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
          [workspace, appointmentId, `${day}T14:00:00+05:30`],
        );
        assert.equal(
          (await rows()).find((a) => a.id === appointmentId)!.id,
          appointmentId,
        );
        await book("11:00");
      },
    );
    await t.test(
      "cancellation keeps Booked attendance and releases its reserved range",
      async () => {
        await db.query(
          "select * from public.mutate_appointment($1,'cancel',p_id=>$2)",
          [workspace, appointmentId],
        );
        const cancelled = (await rows()).find((a) => a.id === appointmentId)!;
        assert.ok(cancelled.cancelled_at);
        assert.equal(cancelled.status, "Booked");
        await book("14:00");
        await assert.rejects(
          () =>
            db.query(
              "select * from public.mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
              [workspace, appointmentId, `${day}T15:00:00+05:30`],
            ),
          { code: "P0001" },
        );
      },
    );
    await t.test(
      "status changes survive re-query and terminal states reject reversal",
      async () => {
        const historical = (await rows()).find(
          (a) => a.status === "Booked" && !a.cancelled_at,
        )!;
        await db.query(
          "select * from public.mutate_appointment($1,'status',p_id=>$2,p_status=>'Done')",
          [workspace, historical.id],
        );
        assert.equal(
          (await rows()).find((a) => a.id === historical.id)!.status,
          "Done",
        );
        await assert.rejects(
          () =>
            db.query(
              "select * from public.mutate_appointment($1,'status',p_id=>$2,p_status=>'Booked')",
              [workspace, historical.id],
            ),
          { code: "P0001" },
        );
      },
    );
    await t.test(
      "cross-workspace writes and future attendance are denied",
      async () => {
        const future =
          (await rows()).find((a) => String(a.starts_at).includes(day)) ??
          (await rows()).at(-1)!;
        await assert.rejects(
          () =>
            db.query(
              "select * from public.mutate_appointment($1,'cancel',p_id=>$2)",
              [other, future.id],
            ),
          { code: "P0002" },
        );
        await assert.rejects(() =>
          db.query(
            "select * from public.mutate_appointment($1,'status',p_id=>$2,p_status=>'No-show')",
            [workspace, future.id],
          ),
        );
      },
    );
    await t.test(
      "anon/authenticated cannot read tables or invoke privileged RPCs",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`set role ${role}`);
          await assert.rejects(
            () => db.query("select * from public.appointments"),
            { code: "42501" },
          );
          await assert.rejects(
            () =>
              db.query("select public.create_demo_workspace($1)", [
                crypto.randomUUID(),
              ]),
            { code: "42501" },
          );
          await assert.rejects(
            () =>
              db.query(
                "select * from public.mutate_appointment($1,'cancel',p_id=>$2)",
                [workspace, appointmentId],
              ),
            { code: "42501" },
          );
          await db.exec("reset role");
        }
      },
    );
  } finally {
    await db.close();
  }
});
