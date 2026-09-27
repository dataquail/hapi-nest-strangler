import type { Database as DatabaseClient } from "@org/database";

// The slonik client behind one DI token. Statements join the ambient
// transaction automatically; nothing here asks the caller which connection.
export interface Database extends DatabaseClient {}
export abstract class Database {}
