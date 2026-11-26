/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function dateInZone(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Converts a wall-clock "YYYY-MM-DDTHH:mm" in the given time zone to an ISO instant. */
export function zonedDateTimeToIso(value: string, timeZone: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let guess = targetWallTime;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const actualWallTime = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess += targetWallTime - actualWallTime;
  }
  return new Date(guess).toISOString();
}
