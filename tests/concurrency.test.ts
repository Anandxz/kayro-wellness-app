import { test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";

// Opt in only against a disposable, empty PostgreSQL database. Never a production DB.
test(
  "two PostgreSQL connections racing for one slot yield one winner",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 3,
    });
    const workspace = crypto.randomUUID();
    try {
      await pool.query(
        await readFile(
          "supabase/migrations/202610280001_appointments.sql",
          "utf8",
        ),
      );
      const seed = await readFile(
        "supabase/migrations/202610280002_sample_data.sql",
        "utf8",
      );
      await pool.query(seed);
      await pool.query(seed);
      await pool.query(
        await readFile(
          "supabase/migrations/202610280003_client_confirmation.sql",
          "utf8",
        ),
      );
      await pool.query(
        await readFile(
          "supabase/migrations/202610280004_revision_guards.sql",
          "utf8",
        ),
      );
      await pool.query("select create_demo_workspace($1)", [workspace]);
      const { rows } = await pool.query<{ starts: Date }>(
        "select ((d::date + time '10:00') at time zone 'Asia/Kolkata') as starts from generate_series((now() at time zone 'Asia/Kolkata')::date+1, (now() at time zone 'Asia/Kolkata')::date+7, interval '1 day') d where extract(dow from d) <> 0 order by d limit 1",
      );
      const starts = rows[0].starts;
      const first = await pool.connect();
      const second = await pool.connect();
      try {
        await first.query("begin");
        const winner = await first.query<{ id: string }>(
          "select * from mutate_appointment($1,'book',p_name=>'Concurrent Client',p_phone=>'+919820099999',p_service=>'initial',p_starts=>$2)",
          [workspace, starts],
        );
        // A separate connection now contends with the uncommitted reservation.
        const loser = second.query(
          "select * from mutate_appointment($1,'book',p_name=>'Concurrent Client',p_phone=>'+919820099999',p_service=>'follow-up',p_starts=>$2)",
          [workspace, starts],
        );
        const rejected = assert.rejects(loser, { code: "23P01" });
        await first.query("commit");
        await rejected;
        const count = await pool.query(
          "select count(*)::int as total from appointments where workspace_id=$1 and starts_at=$2 and cancelled_at is null",
          [workspace, starts],
        );
        assert.equal(count.rows[0].total, 1);
        // A stale confirmation contending with a reschedule must not confirm
        // the new time without the client's review.
        const movedStarts = new Date(starts.getTime() + 60 * 60 * 1000);
        await first.query("begin");
        await first.query(
          "select * from mutate_appointment($1,'reschedule',p_id=>$2,p_starts=>$3)",
          [workspace, winner.rows[0].id, movedStarts],
        );
        const stale = second.query(
          "select * from mutate_appointment($1,'confirm',p_id=>$2,p_starts=>$3)",
          [workspace, winner.rows[0].id, starts],
        );
        const staleRejected = assert.rejects(stale, { code: "P0001" });
        await first.query("commit");
        await staleRejected;
        const saved = await pool.query(
          "select client_confirmed_at from appointments where id=$1",
          [winner.rows[0].id],
        );
        assert.equal(saved.rows[0].client_confirmed_at, null);
      } finally {
        first.release();
        second.release();
      }
    } finally {
      await pool.end();
    }
  },
);
