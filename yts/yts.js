import axios from "axios";
import pool from "../db/pool.js";

async function getLastYtsId() {
  const result = await pool.query(
    "SELECT value FROM app_state WHERE key = 'last_yts_id'"
  );

  return result.rowCount
    ? parseInt(result.rows[0].value, 10)
    : 0;
}

async function setLastYtsId(id) {
  await pool.query(`
    INSERT INTO app_state(key, value)
    VALUES ('last_yts_id', $1)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
  `, [String(id)]);
}

function sizeToBytes(sizeStr) {
  const [value, unit] = sizeStr.split(' ');

  const num = parseFloat(value);

  switch (unit.toUpperCase()) {
    case 'GB':
      return Math.round(num * 1024 * 1024 * 1024);
    case 'MB':
      return Math.round(num * 1024 * 1024);
    case 'KB':
      return Math.round(num * 1024);
    default:
      return Math.round(num);
  }
}



export async function shouldRunYts() {
  const result = await pool.query(
    "SELECT value FROM app_state WHERE key = 'last_yts_run'"
  );

  if (result.rowCount === 0) {
    return true;
  }

  const lastRun = new Date(result.rows[0].value);
  const diffHours = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);

  return diffHours >= 24;
}

export async function updateYtsRunTime() {
  await pool.query(`
    INSERT INTO app_state(key, value)
    VALUES ('last_yts_run', NOW()::text)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
  `);
}