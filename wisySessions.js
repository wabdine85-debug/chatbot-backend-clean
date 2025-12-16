import { pool } from "./db.js";
import crypto from "crypto";

export function newSessionId() {
  return crypto.randomUUID();
}

export async function loadOrCreateSession(session_id) {
  const sid = session_id || newSessionId();

  const { rows } = await pool.query(
    "SELECT session_id, messages, state FROM wisy_chat_sessions WHERE session_id=$1",
    [sid]
  );

  if (rows.length) {
    return {
      session_id: rows[0].session_id,
      messages: rows[0].messages ?? [],
      state: rows[0].state ?? {},
      created: false,
    };
  }

  await pool.query(
    "INSERT INTO wisy_chat_sessions (session_id, messages, state) VALUES ($1, $2::jsonb, $3::jsonb)",
    [sid, JSON.stringify([]), JSON.stringify({})]
  );

  return { session_id: sid, messages: [], state: {}, created: true };
}

export async function saveSession(session_id, messages, state) {
  await pool.query(
    `
    UPDATE wisy_chat_sessions
    SET messages=$2::jsonb, state=$3::jsonb
    WHERE session_id=$1
    `,
    [session_id, JSON.stringify(messages || []), JSON.stringify(state || {})]
  );
}
