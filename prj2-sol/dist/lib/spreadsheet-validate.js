import { default as parse, CellRef } from './expr-parser.js';
import { okResult, errResult } from 'cs544-js-utils';
//factory method
export default async function makeSpreadsheet(name) {
    return okResult(new Spreadsheet(name));
}
export class Spreadsheet {
    name;
    cells;
    constructor(name) {
        this.name = name;
        this.cells = {};
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
        const astResult = parse(expr, cellId);
        if (!astResult.isOk)
            return astResult;
        const ast = astResult.val;
        const validateResult = this.validate(cellId, ast);
        if (!validateResult.isOk)
            return validateResult;
        const cell = this.getCell(cellId);
        if (cell.ast)
            this.removeAsDependent(cellId, cell.ast);
        cell.ast = ast;
        cell.expr = expr;
        const updates = this.evalCell(cell);
        return okResult(updates);
    }
    validate(baseCellId, ast) {
        const prereqs = new Set();
        addAstCells(CellRef.parseRef(baseCellId), ast, prereqs);
        const dependents = [baseCellId];
        while (dependents.length > 0) {
            const dependent = dependents.pop();
            if (prereqs.has(dependent)) {
                const msg = `circular ref involving ${dependent}`;
                return errResult(msg, 'CIRCULAR_REF');
            }
            const depCell = this.getCell(dependent);
            depCell.dependents.forEach(cellId => dependents.push(cellId));
        }
        return okResult(undefined);
    }
    evalCell(cell) {
        const value = this.evalAst(cell.id, cell.ast);
        cell.setValue(value);
        const vals = { [cell.id]: value };
        for (const dependent of cell.dependents) {
            const depCell = this.getCell(dependent);
            const depCellUpdates = this.evalCell(depCell);
            Object.assign(vals, { ...depCellUpdates });
        }
        return vals;
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
        return cell ?? (this.cells[id] = new CellInfo(id));
    }
}
function addAstCells(baseCell, ast, cellIds) {
    if (ast.kind === 'app') {
        ast.kids.forEach(k => addAstCells(baseCell, k, cellIds));
    }
    else if (ast.kind === 'ref') {
        const cellId = ast.value.toText(baseCell).replace(/\$/g, '');
        cellIds.add(cellId);
    }
}
class CellInfo {
    id;
    value;
    expr;
    ast;
    dependents;
    constructor(id) {
        this.id = id;
        this.value = 0;
        this.ast = undefined;
        this.dependents = new Set();
    }
    setValue(value) {
        this.value = value;
    }
    addDependent(cellId) {
        this.dependents.add(cellId);
    }
    rmDependent(cellId) {
        this.dependents.delete(cellId);
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
//# sourceMappingURL=spreadsheet-validate.js.map