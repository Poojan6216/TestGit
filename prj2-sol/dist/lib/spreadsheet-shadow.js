import parse from './expr-parser.js';
import { CellRef } from './expr-parser.js';
import { okResult, errResult } from 'cs544-js-utils';
//factory method
export default async function makeSpreadsheet(name) {
    return okResult(new Spreadsheet(name));
}
export class Spreadsheet {
    name;
    cells;
    updatedCells;
    constructor(name) {
        this.name = name;
        this.cells = {};
        this.updatedCells = {};
    }
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
    async eval(cellId, expr) {
        this.updatedCells = {};
        const astResult = parse(expr, cellId);
        if (!astResult.isOk)
            return astResult;
        const ast = astResult.val;
        const cell = this.updateCell(cellId);
        if (cell.ast)
            this.removeAsDependent(cellId, cell.ast);
        cell.ast = ast;
        const updatesResult = this.evalCell(cell);
        if (!updatesResult.isOk) {
            return updatesResult;
        }
        else {
            Object.assign(this.cells, this.updatedCells);
            return updatesResult;
        }
    }
    evalCell(cell, working = new Set) {
        const value = this.evalAst(cell.id, cell.ast);
        this.updateCell(cell.id, cell => cell.value = value);
        const vals = { [cell.id]: value };
        working.add(cell.id);
        for (const dependent of cell.dependents) {
            if (working.has(dependent)) {
                const msg = `circular ref involving ${dependent}`;
                return errResult(msg, 'CIRCULAR_REF');
            }
            const depCell = this.getCell(dependent);
            const depCellResult = this.evalCell(depCell, working);
            if (!depCellResult.isOk)
                return depCellResult;
            Object.assign(vals, { ...depCellResult.val });
        }
        working.delete(cell.id);
        return okResult(vals);
    }
    evalAst(baseCellId, ast) {
        if (ast === null || ast === undefined) {
            return 0;
        }
        else if (ast.kind === 'num') {
            return ast.value;
        }
        else if (ast.kind === 'ref') {
            const baseCell = CellRef.parseRef(baseCellId);
            const cellId = ast.toText(baseCell);
            const cell = this.updateCell(cellId, cell => cell.dependents.add(baseCellId));
            return cell.value;
        }
        else {
            console.assert(ast.kind === 'app', `unknown ast type ${ast.kind}`);
            const f = FNS[ast.fn];
            console.assert(!!f, `unknown ast fn ${ast.fn}`);
            return f(this.evalAst(baseCellId, ast.kids[0]), ast.kids[1] && this.evalAst(baseCellId, ast.kids[1]));
        }
    }
    removeAsDependent(baseCellId, ast) {
        if (ast.kind === 'app') {
            ast.kids.forEach(k => this.removeAsDependent(baseCellId, k));
        }
        else if (ast.kind === 'ref') {
            const baseCell = CellRef.parseRef(baseCellId);
            const cellId = ast.toText(baseCell);
            this.updateCell(cellId, cell => cell.dependents.delete(baseCellId));
        }
    }
    getCell(cellId) {
        const id = cellId.replace(/\$/g, '');
        const cell = this.updatedCells[id] ?? this.cells[id];
        return cell ?? (this.cells[id] = new CellInfo(id));
    }
    updateCell(cellId, updateFn) {
        const cell = this.updatedCells[cellId]
            ?? (this.updatedCells[cellId] = this.getCell(cellId).copy());
        if (updateFn)
            updateFn(cell);
        return cell;
    }
}
class CellInfo {
    id;
    value;
    ast;
    dependents;
    constructor(id) {
        this.id = id;
        this.value = 0;
        this.ast = undefined;
        this.dependents = new Set();
    }
    copy() {
        const copy = new CellInfo(this.id);
        copy.value = this.value;
        copy.ast = this.ast;
        copy.dependents = new Set(this.dependents);
        return copy;
    }
}
const FNS = {
    '+': (a, b) => a + b,
    '-': (a, b) => b === undefined ? -a : a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    min: (a, b) => Math.min(a, b),
    max: (a, b) => Math.max(a, b),
};
//# sourceMappingURL=spreadsheet-shadow.js.map