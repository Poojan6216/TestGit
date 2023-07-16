import { okResult, errResult } from 'cs544-js-utils';
import * as mongo from 'mongodb';
const mongodbUrl = 'mongodb+srv://poojanpatel119:Poojan6216@ppatel17.waj9koq.mongodb.net/?retryWrites=true&w=majority'; // Replace with your MongoDB connection URL
const dbName = 'mydatabase';
const collectionName = 'mycollection';
export async function makeSpreadsheetDao(mongodbUrl, ssName) {
    return SpreadsheetDao.make(mongodbUrl, ssName);
}
export class SpreadsheetDao {
    client;
    db;
    collection;
    constructor(client, db, collection) {
        this.client = client;
        this.db = db;
        this.collection = collection;
    }
    static async make(dbUrl, ssName) {
        try {
            const client = await mongo.MongoClient.connect(dbUrl);
            const db = client.db(ssName);
            const collection = db.collection('cells');
            return okResult(new SpreadsheetDao(client, db, collection));
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
    async close() {
        try {
            await this.client.close();
            return okResult(undefined);
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
    getSpreadsheetName() {
        return this.db.databaseName;
    }
    async setCellExpr(cellId, expr) {
        try {
            const filter = { _id: new mongo.ObjectId(cellId) };
            await this.collection.updateOne(filter, { $set: { expr } }, { upsert: true });
            return okResult(undefined);
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
    async query(cellId) {
        try {
            const filter = { _id: new mongo.ObjectId(cellId) };
            const result = await this.collection.findOne(filter);
            const expr = result ? result.expr : '';
            return okResult(expr);
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
    async clear() {
        try {
            await this.collection.deleteMany({});
            return okResult(undefined);
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
    async remove(cellId) {
        try {
            const filter = { _id: new mongo.ObjectId(cellId) };
            await this.collection.deleteOne(filter);
            return okResult(undefined);
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
    async getData() {
        try {
            const data = await this.collection.find().toArray();
            const cellData = data.map((item) => [item._id, item.expr]);
            return okResult(cellData);
        }
        catch (error) {
            return errResult('DB', error.message);
        }
    }
}
//# sourceMappingURL=spreadsheet-dao.js.map