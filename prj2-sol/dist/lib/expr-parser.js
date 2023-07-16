import { colSpecToIndex, rowSpecToIndex, indexToColSpec, indexToRowSpec, } from './utils.js';
import { panic, errResult, okResult } from 'cs544-js-utils';
/************************* Top Level Functions *************************/
/*
Default export is

parseExpr(expr, baseCellRef): Result<Ast>

expr is a string specifying a spreadsheet formula which could be typed
by an end-user into the cell specified by baseCellRef.  All relative
references in expr are WRT baseCellRef.

If an error is detected in `expr` or `baseCellRef`, then the result
is an error-result; otherwise it is an ok-result with val set to the Ast.

An AST is described below.
*/
export default function parseExpr(expr, base = 'A1') {
    let baseCell;
    if (typeof base === 'string') {
        const baseCellResult = CellRef.parse(base);
        if (!baseCellResult.isOk)
            return baseCellResult;
        baseCell = baseCellResult.val;
    }
    else {
        baseCell = base;
    }
    ;
    const tokensResult = scan(expr, baseCell);
    if (!tokensResult.isOk)
        return tokensResult;
    const parser = new ExprParser(tokensResult.val, baseCell);
    return parser.parse();
}
class RefAst {
    kind;
    value;
    constructor(value) {
        this.kind = 'ref';
        this.value = value;
    }
    prec() { return MAX_PREC; }
    toText(baseCell) {
        return this.value.toText(baseCell);
    }
}
class NumAst {
    kind;
    value;
    constructor(value) {
        this.kind = 'num';
        this.value = value;
    }
    prec() { return MAX_PREC; }
    toText(baseCell) {
        return this.value.toString();
    }
}
class AppAst {
    kind;
    fn;
    kids;
    constructor(fn, kids) {
        this.kind = 'app';
        this.fn = fn;
        this.kids = kids;
    }
    prec() {
        return (this.fn === 'max' || this.fn === 'min')
            ? MAX_PREC
            : OPS[this.fn].prec;
    }
    toText(baseCell) {
        const fn = this.fn;
        if (fn === 'max' || fn === 'min') {
            return fn +
                '(' + this.kids.map(k => k.toText(baseCell)).join(', ') + ')';
        }
        else {
            const fnInfo = OPS[fn];
            if (fnInfo.assoc === 'left') {
                if (this.kids.length === 1) {
                    console.assert(fn === '-', "'-' is only unary operator");
                    return fn + this.kids[0].toText(baseCell);
                }
                else {
                    console.assert(this.kids.length === 2, 'assoc operator must be binary');
                    const p0 = (this.kids[0].prec() < fnInfo.prec);
                    const p1 = (this.kids[1].prec() <= fnInfo.prec);
                    return AppAst.left(p0) +
                        this.kids[0].toText(baseCell) + AppAst.right(p0) + fn +
                        AppAst.left(p1) + this.kids[1].toText(baseCell) +
                        AppAst.right(p1);
                }
            }
            else {
                panic(`operator type ${fnInfo.assoc} not handled`);
            }
        }
    }
    static left(isParen) { return isParen ? '(' : ''; }
    static right(isParen) { return isParen ? ')' : ''; }
}
/******************************** Parser ******************************/
/*  Crude recursive descent parser:
expr is a spreadsheet formula specified by the following EBNF grammar:

expr
  : term ( ( '+' | '-' ) term )*
  ;
term
  : factor ( ( '*' | '/' ) factor )*
  ;
factor
  : NUMBER
  | '-' factor
  | FN '(' expr ( ',' expr )* ')'
  | cellRef
  | '(' expr ')'
  ;
cellRef
  : '$'? LETTER '$'? DIGITS+ //no intervening whitespace

The above grammar gives the structure of a language over some
vocabulary of symbols (for the spreadsheet, the vocabulary consists
numbers, cell references, function names like max and min, arithmetic
operators like + and * and punctuation symbols like , ( and ).

The grammar specifies the phrases in the language recognized by the
grammar using rules of the form

phrase
  : alt1
  | alt2
  | ...
  | altn
  ;

The top level phrase in the grammar is expr.

The alternatives alt1, alt2, ..., altN for each rule consists of a
sequence of symbols of the following kind:

  Vocabulary Symbols:
    Enclosed within single-quotes '...' or an all upper-case identifier;
    the former stand for themselves; the latter are not defined further
    and stand for what is implied by their name.

  Phrase Symbols:
    An identifier starting with a lower-case letter.  Defined by
    a grammar rule.

  Meta Symbols:
    These are part of the grammar notation:

       * postfix operator denoting 0-or-more repetitions of the previous symbol.

       ? postfix operator denoting previous symbol is optional.

       | infix operator denoting alternatives

       ( ) used for grouping symbols

Note that quoted '(' and ')' are vocabulary symbols whereas ( ) are
meta symbols used for grouping.

For example, the first rule above:

expr
  : term ( ( '+' | '-' ) term )*
  ;

says that an expr consists of 1-or-more term's separated by '+' or
'-'.

*/
class ExprParser {
    baseCell;
    toks;
    nToks;
    tok; //current lookahead
    index; //index of next token
    constructor(tokens, baseCell) {
        this.baseCell = baseCell;
        this.toks = tokens;
        this.nToks = tokens.length;
        if (this.nToks === 0)
            panic('no tokens: expect at least EOF token');
        this.tok = this.toks[0];
        this.index = 1;
    }
    nextTok() {
        if (this.index >= this.nToks)
            panic(`nextTok() bad index '${this.index}'`);
        this.tok = this.toks[this.index++];
    }
    peek(kind, lexeme) {
        return this.tok.kind === kind && (!lexeme || this.tok.lexeme === lexeme);
    }
    consume(kind, lexeme) {
        if (this.peek(kind, lexeme)) {
            if (this.tok.kind !== 'EOF')
                this.nextTok();
        }
        else {
            throw `unexpected token at '${this.tok.lexeme}': expected '${kind}'`;
        }
    }
    parse() {
        try {
            const e = this.expr();
            if (!this.peek('EOF'))
                return errResult('expected EOF', 'SYNTAX');
            return okResult(e);
        }
        catch (err) {
            return errResult(err, 'SYNTAX');
        }
    }
    expr() {
        let t0 = this.term();
        while (this.peek('+') || this.peek('-')) {
            const op = this.tok.kind;
            this.nextTok();
            const t1 = this.term();
            t0 = new AppAst(op, [t0, t1]);
        }
        return t0;
    }
    term() {
        let f0 = this.factor();
        while (this.peek('*') || this.peek('/')) {
            const op = this.tok.kind;
            this.nextTok();
            const f1 = this.factor();
            f0 = new AppAst(op, [f0, f1]);
        }
        return f0;
    }
    factor() {
        let e;
        if (this.peek('(')) {
            this.nextTok();
            e = this.expr();
            this.consume(')');
        }
        else if (this.peek('ref')) {
            e = new RefAst(this.tok.value);
            this.nextTok();
        }
        else if (this.peek('-')) {
            this.nextTok();
            const operand = this.factor();
            e = new AppAst('-', [operand]);
        }
        else if (this.peek('fn')) {
            const fn = this.tok.lexeme;
            this.nextTok();
            this.consume('(');
            const args = [];
            args.push(this.expr());
            while (this.peek(',')) {
                this.nextTok();
                args.push(this.expr());
            }
            this.consume(')');
            e = new AppAst(fn, args);
        }
        else {
            const t = this.tok;
            this.consume('num');
            e = new NumAst(t.value);
        }
        return e;
    }
}
function scan(str, baseCell) {
    const tokens = [];
    while ((str = str.trimLeft()).length > 0) {
        let tok;
        const c = str[0];
        if (c.match(/\d/)) {
            const [lexeme] = str.match(/^\d+(\.\d+)?([eE][-+]?\d+)?/);
            tok = { kind: 'num', lexeme, value: Number(lexeme) };
        }
        else if (c.match(/[\w\$]/)) {
            const [lexeme] = str.match(/^[\w\$]+/);
            if (lexeme === 'max' || lexeme === 'min') {
                tok = { kind: 'fn', lexeme, };
            }
            else {
                const cellRefResult = CellRef.parse(lexeme, baseCell);
                if (!cellRefResult.isOk)
                    return cellRefResult;
                tok = { kind: 'ref', lexeme, value: cellRefResult.val };
            }
        }
        else {
            tok = { kind: c, lexeme: c, };
        }
        str = str.slice(tok.lexeme.length);
        tokens.push(tok);
    } //while
    tokens.push({ kind: 'EOF', lexeme: '<EOF>', });
    return okResult(tokens);
}
//for testing only
export { scan };
/**************************** Cell Reference ***************************/
class Coord {
    index;
    isAbs;
    constructor(index, isAbs) {
        this.index = index;
        this.isAbs = isAbs;
    }
}
;
export class CellRef {
    col;
    row;
    constructor(col, row) {
        this.col = col;
        this.row = row;
    }
    /** validate and parse ref-string relative to baseCell */
    static parse(ref, baseCell = CELL_A1) {
        ref = ref.trim().toLowerCase();
        const match = ref.match(/^(\$?)([a-zA-Z])(\$?)(\d+)$/);
        if (!match) {
            return errResult(`bad cell ref ${ref}`, 'SYNTAX');
        }
        else {
            return okResult(CellRef.parseRef(ref, baseCell));
        }
    }
    /** parse ref-string wrt baseCell; assumes ref is valid */
    static parseRef(ref, baseCell = CELL_A1) {
        const match = ref.match(/^(\$?)([a-zA-Z])(\$?)(\d+)$/);
        const [_, isAbsCol, colSpec, isAbsRow, rowSpec] = match;
        const colIndex = colSpecToIndex(colSpec) - (isAbsCol ? 0 : baseCell.col.index ?? 0);
        const rowIndex = rowSpecToIndex(rowSpec) - (isAbsRow ? 0 : baseCell.row.index ?? 0);
        const col = new Coord(colIndex, !!isAbsCol);
        const row = new Coord(rowIndex, !!isAbsRow);
        return new CellRef(col, row);
    }
    toText(baseCell = CELL_A1) {
        let str = '';
        if (this.col.isAbs) {
            str += '$' + indexToColSpec(this.col.index);
        }
        else {
            str += indexToColSpec(this.col.index, baseCell.col.index);
        }
        if (this.row.isAbs) {
            str += '$' + indexToRowSpec(this.row.index);
        }
        else {
            str += indexToRowSpec(this.row.index, baseCell.row.index);
        }
        return str;
    }
}
/********************************** Data *******************************/
const CELL_A1 = new CellRef(new Coord(0, false), new Coord(0, false));
const MAX_PREC = 100;
/* Operator Information */
const OPS = {
    '+': {
        fn: '+',
        prec: 10,
        assoc: 'left',
    },
    '-': {
        fn: '-',
        prec: 10,
        assoc: 'left',
    },
    '*': {
        fn: '*',
        prec: 20,
        assoc: 'left',
    },
    '/': {
        fn: '/',
        prec: 20,
        assoc: 'left',
    },
};
//# sourceMappingURL=expr-parser.js.map