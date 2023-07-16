import { Result } from 'cs544-js-utils';
import * as mongo from 'mongodb';
export declare function makeSpreadsheetDao(mongodbUrl: string, ssName: string): Promise<Result<SpreadsheetDao>>;
export declare class SpreadsheetDao {
    private client;
    private db;
    private collection;
    constructor(client: mongo.MongoClient, db: mongo.Db, collection: mongo.Collection);
    static make(dbUrl: string, ssName: string): Promise<Result<SpreadsheetDao>>;
    close(): Promise<Result<undefined>>;
    getSpreadsheetName(): string;
    setCellExpr(cellId: string, expr: string): Promise<Result<undefined>>;
    query(cellId: string): Promise<Result<string>>;
    clear(): Promise<Result<undefined>>;
    remove(cellId: string): Promise<Result<undefined>>;
    getData(): Promise<Result<[string, string][]>>;
}
//# sourceMappingURL=spreadsheet-dao.d.ts.map