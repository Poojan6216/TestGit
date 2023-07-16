import parse from './expr-parser.js';
import makeSpreadsheet from './spreadhsheet.js';
import { panic } from 'cs544-js-utils';
import readline from 'readline';
/************************* Top level routine ***************************/
export default async function go() {
    const spreadsheetResult = await makeSpreadsheet('test');
    if (!spreadsheetResult.isOk) {
        error(spreadsheetResult);
    }
    else {
        await repl(spreadsheetResult.val);
    }
}
const PROMPT = '>> ';
async function repl(spreadsheet) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
        prompt: PROMPT,
    });
    rl.on('line', async (line) => await doLine(spreadsheet, line, rl));
    rl.prompt();
}
async function doLine(spreadsheet, line, rl) {
    try {
        line = line.trim();
        if (line.length > 0) {
            const splits = line.split('=');
            if (splits.length !== 2) {
                console.error('input must be of type "cellId = expr"');
            }
            else if (splits[0].indexOf('$') >= 0) {
                console.error('cellId being assigned to cannot contain absolute refs');
            }
            else {
                const [baseCellId, expr] = [splits[0].trim(), splits[1]];
                const verifyBaseCellIdResult = parse(baseCellId);
                if (!verifyBaseCellIdResult.isOk) {
                    error(verifyBaseCellIdResult);
                }
                else {
                    const evalResult = await spreadsheet.eval(baseCellId.trim(), expr);
                    if (!evalResult.isOk) {
                        error(evalResult);
                    }
                    else {
                        const results = evalResult.val;
                        const sortedResultPairs = Object.keys(results).sort().map(k => [k, results[k]]);
                        console.log(Object.fromEntries(sortedResultPairs));
                    }
                }
            }
        }
    }
    catch (err) {
        panic('unexpected exception', err);
    }
    rl.prompt();
}
function error(err) {
    if (err.isOk === false) {
        for (const e of err.errors) {
            console.error(`${e.options.code}: ${e.message}`);
        }
    }
    else {
        panic(`called error() with a successful Result ${err}`);
    }
}
//# sourceMappingURL=cli.js.map