import {default as parse, CellRef, Ast } from './expr-parser.js';

import { Result, okResult, errResult } from 'cs544-js-utils';

//factory method
export default async function makeSpreadsheet(name: string) :
  Promise<Result<Spreadsheet>>
{
  return okResult(new Spreadsheet(name));
}

type Updates = { [cellId: string]: number };
export class Spreadsheet {

  readonly name: string;
  readonly cells: { [cellId: string]: CellInfo };
  
  constructor(name: string) {
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
  async eval(cellId: string, expr: string) : Promise<Result<Updates>> {
    const astResult = parse(expr, cellId);
    if (!astResult.isOk) return astResult;
    const ast = astResult.val;
    const validateResult = this.validate(cellId, ast);
    if (!validateResult.isOk) return validateResult;
    const cell = this.getCell(cellId);
    if (cell.ast) this.removeAsDependent(cellId, cell.ast);
    cell.ast = ast; cell.expr = expr;
    const updates = this.evalCell(cell);
    return okResult(updates);
  }

  private validate(baseCellId: string, ast:Ast) : Result<undefined> {
    const prereqs = new Set<string>();
    addAstCells(CellRef.parseRef(baseCellId), ast, prereqs);
    const dependents = [ baseCellId ];
    while (dependents.length > 0) {
      const dependent = dependents.pop() as string;
      if (prereqs.has(dependent)) {
	const msg = `circular ref involving ${dependent}`;
	return errResult(msg, 'CIRCULAR_REF');
      }
      const depCell = this.getCell(dependent);
      depCell.dependents.forEach(cellId => dependents.push(cellId));
    }
    return okResult(undefined);
  }

  private evalCell(cell: CellInfo) : Updates {
    const value = this.evalAst(cell.id, cell.ast);
    cell.setValue(value);
    const vals = { [cell.id]: value };
    for (const dependent of cell.dependents) {
      const depCell = this.getCell(dependent);
      const depCellUpdates = this.evalCell(depCell);
      Object.assign(vals, {...depCellUpdates});
    }
    return vals;
  }

  private evalAst(baseCellId: string, ast?: Ast) : number {
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
      return f(this.evalAst(baseCellId, ast.kids[0]),
	       ast.kids[1] && this.evalAst(baseCellId, ast.kids[1]));
    }
  }

  private removeAsDependent(baseCellId: string, ast: Ast) {
    if (ast.kind === 'app') {
      ast.kids.forEach(k => this.removeAsDependent(baseCellId, k));
    }
    else if (ast.kind === 'ref') {
      const baseCell = CellRef.parseRef(baseCellId);
      const cellId = ast.toText(baseCell);
      this.getCell(cellId).rmDependent(baseCellId);
    }
  }

  private getCell(cellId: string) {
    const id = cellId.replace(/\$/g, '');
    const cell = this.cells[id];
    return cell ?? (this.cells[id] = new CellInfo(id));
  }
}

function addAstCells(baseCell: CellRef, ast: Ast, cellIds: Set<string>) {
  if (ast.kind === 'app') {
    ast.kids.forEach(k => addAstCells(baseCell, k, cellIds));
  }
  else if (ast.kind === 'ref') {
    const cellId = ast.value.toText(baseCell).replace(/\$/g, '');
    cellIds.add(cellId);
  }
}

class CellInfo {

  readonly id: string;
  value: number;
  expr: string;
  ast?: Ast;
  dependents: Set<string>;
    
  constructor(id: string) {
    this.id = id;
    this.value = 0;
    this.ast = undefined;
    this.dependents = new Set();
  }
  
  setValue(value: number) {
    this.value = value;
  }
  addDependent(cellId: string) {
    this.dependents.add(cellId);
  }
  rmDependent(cellId: string) {
    this.dependents.delete(cellId);
  }
}

const FNS = {
  '+': (a:number, b:number) : number => a + b,
  '-': (a:number, b?:number) : number => b === undefined ? -a : a - b,
  '*': (a:number, b:number) : number => a * b,
  '/': (a:number, b:number) : number => a / b,
  min: (a:number, b:number) : number => Math.min(a, b),
  max: (a:number, b:number) : number => Math.max(a, b),
}
