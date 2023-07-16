import { default as parse, CellRef } from './expr-parser.js';
import { okResult, errResult } from 'cs544-js-utils';
//factory method
export default async function makeSpreadsheet(name) {
    return okResult(new Spreadsheet(name));
}
export class Spreadsheet {
    name;
    cells;
    undos;
    constructor(name) {
        this.name = name;
        this.cells = {};
        this.undos = [];
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
        this.undos.length = 0;
        const astResult = parse(expr, cellId);
        if (!astResult.isOk)
            return astResult;
        const ast = astResult.val;
        const cell = this.getCell(cellId);
        if (cell.ast)
            this.removeAsDependent(cellId, cell.ast);
        cell.ast = ast;
        cell.expr = expr;
        const updatesResult = this.evalCell(cell);
        if (!updatesResult.isOk) {
            while (this.undos.length > 0) {
                const undo = this.undos.pop();
                if (undo.kind === 'value') {
                    undo.cell.value = undo.value;
                }
                else {
                    undo.cell.dependents = undo.value;
                }
            }
        }
        return updatesResult;
    }
    evalCell(cell, working = new Set()) {
        const value = this.evalAst(cell.id, cell.ast);
        cell.setValue(value);
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
            const cell = this.getCell(cellId);
            cell.addDependent(baseCellId);
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
            this.getCell(cellId).rmDependent(baseCellId);
        }
    }
    getCell(cellId) {
        const id = cellId.replace(/\$/g, '');
        const cell = this.cells[id];
        return cell ?? (this.cells[id] = new CellInfo(id, this));
    }
}
class CellInfo {
    id;
    spreadsheet;
    expr;
    value;
    ast;
    dependents;
    constructor(id, spreadsheet) {
        this.id = id;
        this.spreadsheet = spreadsheet;
        this.expr = '';
        this.value = 0;
        this.ast = undefined;
        this.dependents = new Set();
    }
    setValue(value) {
        const undo = { cell: this, kind: 'value', value: this.value };
        this.spreadsheet.undos.push(undo);
        this.value = value;
    }
    addDependent(cellId) {
        this.setupDependentsUndo();
        this.dependents.add(cellId);
    }
    rmDependent(cellId) {
        this.setupDependentsUndo();
        this.dependents.delete(cellId);
    }
    setupDependentsUndo() {
        const dependents = new Set(this.dependents);
        const undo = { cell: this, kind: 'dependents', value: dependents };
        this.spreadsheet.undos.push(undo);
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
//# sourceMappingURL=spreadhsheet.js.map