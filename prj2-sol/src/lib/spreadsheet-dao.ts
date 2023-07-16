import { Result, okResult, errResult } from 'cs544-js-utils';

import * as mongo from 'mongodb';

/** All that this DAO should do is maintain a persistent map from
 *  [spreadsheetName, cellId] to an expression string.
 *
 *  Most routines return an errResult with code set to 'DB' if
 *  a database error occurs.
 */

/** return a DAO for spreadsheet ssName at URL mongodbUrl */
export async function
makeSpreadsheetDao(mongodbUrl: string, ssName: string)
  : Promise<Result<SpreadsheetDao>> 
{
  return SpreadsheetDao.make(mongodbUrl, ssName);
}

export class SpreadsheetDao {

  private client: mongo.MongoClient;
  private data: mongo.Collection;
  private ssName: string;
  
  private constructor(ssName: string, client: mongo.MongoClient,
		      data: mongo.Collection)
  {
    Object.assign(this, {ssName, client, data});
  }

  //factory method
  static async make(dbUrl: string, ssName: string)
    : Promise<Result<SpreadsheetDao>>
  {
    try {
      const client = await (new mongo.MongoClient(dbUrl)).connect();;
      const data = client.db().collection(ssName);
      await data.createIndex('cellId');
      return okResult(new SpreadsheetDao(ssName, client, data));
    }
    catch (err) {
      const msg = `cannot connect to URL "${dbUrl}": ${err}`;
      return errResult(msg, 'DB');
    }
  }

  /** Release all resources held by persistent spreadsheet.
   *  Specifically, close any database connections.
   */
  async close() : Promise<Result<undefined>> {
    try {
      await this.client.close();
      return okResult(undefined);
    }
    catch (err) {
      const msg = `cannot close DB for ${this.ssName}: ${err}`;
      return errResult(msg, 'DB');
    }
  }

  /** return name of this spreadsheet */
  getSpreadsheetName() : string {
    return this.ssName;
  }

  /** Set cell with id cellId to string expr. */
  async setCellExpr(cellId: string, expr: string)
    : Promise<Result<undefined>>
  {
    try {
      await this.data.updateOne({cellId}, {$set: { expr }},
				{ upsert: true });
      return okResult(undefined);
    }
    catch (err) {
      const msg =
	`cannot update "${this.ssName}:${cellId}: ${err}`;
      return errResult(msg, 'DB');
    }
  }

  /** Return expr for cell cellId; return '' for an empty/unknown cell.
   */
  async query(cellId: string) : Promise<Result<string>> {
    try {
      const cursor = await this.data.find({ cellId });
      const cells = await cursor.toArray();
      console.assert(cells.length <= 1);
      const ret = (cells.length > 0) ? cells[0].expr : '';
      return okResult(ret);
    }
    catch (err) {
      const msg = `cannot query "${this.ssName}:${cellId}: ${err}`;
      return errResult(msg, 'DB');
    }
  }

  /** Clear contents of this spreadsheet */
  async clear() : Promise<Result<undefined>> {
    try {
      const collections = await this.client.db().listCollections().toArray();
      if (collections.find(c => c.name === this.ssName)) {
	await this.data.drop();
      }
      return okResult(undefined);
    }
    catch (err) {
      const msg = `cannot drop collection ${this.ssName}: ${err}`;
      return errResult(msg, 'DB');
    }
  }

  /** Remove all info for cellId from this spreadsheet. */
  async remove(cellId: string) : Promise<Result<undefined>> {
    let results;
    try {
      await this.data.deleteOne({cellId});
      return okResult(undefined);
    }
    catch (err) {
      const msg = `cannot remove ${cellId}: ${err}`;
      return errResult(msg, 'DB');
    }
  }

  /** Return array of [ cellId, expr ] pairs for all cells in this
   *  spreadsheet
   */
  async getData() : Promise<Result<[string, string][]>> {
    try {
      const data: [string, string][] = [];
      const cursor = await this.data.find({}); 
      const cells = await cursor.toArray();
      for (const {cellId, expr} of cells) {
	data.push([cellId, expr]);
      }
      return okResult(data);
    }
    catch (err) {
      const msg = `cannot get data for ${this.ssName}: ${err}`;
      return errResult(msg, 'DB');
    }
  }

}




