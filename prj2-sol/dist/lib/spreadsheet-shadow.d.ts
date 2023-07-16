import { Ast } from './expr-parser.js';
import { Result } from 'cs544-js-utils';
export default function makeSpreadsheet(name: string): Promise<Result<Spreadsheet>>;
type Updates = {
    [cellId: string]: number;
};
export declare class Spreadsheet {
    readonly name: string;
    readonly cells: {
        [cellId: string]: CellInfo;
    };
    updatedCells: {
        [cellId: string]: CellInfo;
    };
    constructor(name: string);
    /** Set cell with id cellId to result of evaluating formula
     *  specified by the string expr.  Update all cells which are
     *  directly or indirectly dependent on the base cell cellId.
     *  Return an object mapping the id's of all updated cells to
     *  their updated values.
     *
     *  Errors must be reported by returning an error Result having its
     *  code options property set to `SYNTAX` for a syntax error and
     *  `CIRCULAR_REF` for a circular reference and message property set
     *  to a suitable error message.
     */
    eval(cellId: string, expr: string): Promise<Result<Updates>>;
    evalCell(cell: CellInfo, working?: Set<string>): Result<Updates>;
    evalAst(baseCellId: string, ast?: Ast): number;
    removeAsDependent(baseCellId: string, ast: Ast): void;
    getCell(cellId: string): CellInfo;
    updateCell(cellId: string, updateFn?: (cell: CellInfo) => void): CellInfo;
}
declare class CellInfo {
    readonly id: string;
    value: number;
    ast?: Ast;
    dependents: Set<string>;
    constructor(id: string);
    copy(): CellInfo;
}
export {};
//# sourceMappingURL=spreadsheet-shadow.d.ts.map