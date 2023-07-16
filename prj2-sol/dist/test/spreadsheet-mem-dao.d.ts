import { SpreadsheetDao } from '../lib/spreadsheet-dao.js';
export default class MemSpreadsheetDao {
    static setup(ssName: string): Promise<SpreadsheetDao>;
    static tearDown(dao: SpreadsheetDao): Promise<void>;
}
//# sourceMappingURL=spreadsheet-mem-dao.d.ts.map