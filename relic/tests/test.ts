import assert from 'node:assert/strict';
import { Lexer, TokenTypeKind, LispNumber } from '../tokenizer.js';
import { parse } from '../parser.js';
import { preprocess } from '../preprocess.js';
import { evalNode } from '../eval.js';
import {
  NodeData, NodeRef, NodeEnv, nilNode, nilRef, ref,
  nodeFromIter, nodeEqual, vectorize, patternFromNode,
} from '../node.js';
import { SpecialForm, BuiltinSymbol, makeSymbol, symbolToString } from '../symbol.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${(e as Error).message}`);
  }
}

function n(val: number, isInt = true): NodeData {
  return { type: 'number', num: isInt ? LispNumber.fromInt(val) : LispNumber.fromFloat(val) };
}

function sym(name: string): NodeData {
  return { type: 'symbol', sym: makeSymbol(name) };
}

function builtin(b: BuiltinSymbol): NodeData {
  return { type: 'symbol', sym: b };
}

const nil: NodeData = nilNode();
const t: NodeData = { type: 'symbol', sym: BuiltinSymbol.T };

function list(...items: NodeData[]): NodeData {
  return nodeFromIter(items.map(ref));
}

function evalToNode(input: string, env?: NodeEnv, macros?: Map<string, any>): NodeData {
  const tokens = new Lexer(input);
  const node = parse(tokens);
  const processed = preprocess(node, macros ?? new Map());
  const result = evalNode(processed, env ?? NodeEnv.top(), {
    writeOutput: () => {},
    writeStdout: () => {},
    writeGraph: () => {},
  });
  return result.node.node;
}

function assertNodeEqual(actual: NodeData, expected: NodeData, msg?: string) {
  if (!nodeEqual(actual, expected)) {
    throw new Error(
      (msg ? msg + ': ' : '') +
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertError(input: string, expectedMsg: string, env?: NodeEnv) {
  try {
    const tokens = new Lexer(input);
    const node = parse(tokens);
    const processed = preprocess(node, new Map());
    evalNode(processed, env ?? NodeEnv.top(), {
      writeOutput: () => {},
      writeStdout: () => {},
      writeGraph: () => {},
    });
    throw new Error(`Expected error "${expectedMsg}" but no error was thrown`);
  } catch (e: any) {
    if (!e.message.includes(expectedMsg)) {
      throw new Error(`Expected error containing "${expectedMsg}", got "${e.message}"`);
    }
  }
}

function assertEvalInEnv(input: string, env: NodeEnv, macros: Map<string, any>, expected: NodeData) {
  const result = evalToNode(input, env, macros);
  assertNodeEqual(result, expected, input);
}

function assertEval(input: string, expected: NodeData) {
  assertEvalInEnv(input, NodeEnv.top(), new Map(), expected);
}

// === Lexer Tests ===

function collectTokens(input: string): Array<{ kind: TokenTypeKind; value?: any }> {
  const lexer = new Lexer(input);
  const result: Array<{ kind: TokenTypeKind; value?: any }> = [];
  let tok;
  while ((tok = lexer.next()) !== null) {
    result.push({ kind: tok.kind, value: tok.value });
  }
  return result;
}

function assertTokens(input: string, expected: Array<{ kind: TokenTypeKind; value?: any }>) {
  const actual = collectTokens(input);
  assert.deepEqual(actual, expected, `Token mismatch for input: ${input}`);
}

function assertTokenKinds(input: string, expectedKinds: TokenTypeKind[]) {
  const actual = collectTokens(input);
  const kinds = actual.map(t => t.kind);
  assert.deepEqual(kinds, expectedKinds, `Token kind mismatch for input: ${input}`);
}

// === Parser Tests ===

function parseToNode(input: string): NodeData {
  return parse(new Lexer(input));
}

// === Suite: Lexer ===

console.log('\nLexer Tests:');
test('empty input', () => {
  assertTokenKinds('', []);
});

test('whitespace only', () => {
  assertTokenKinds('   \n\t  ', []);
});

test('numeric literal', () => {
  const result = collectTokens('123456');
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, TokenTypeKind.Number);
  const num = result[0].value as LispNumber;
  assert.equal(num.intVal, 123456);
  assert.equal(num.isInt, true);
});

test('parentheses', () => {
  assertTokenKinds('(())', [
    TokenTypeKind.LParen,
    TokenTypeKind.LParen,
    TokenTypeKind.RParen,
    TokenTypeKind.RParen,
  ]);
});

test('quote token', () => {
  assertTokenKinds("'(1 2 3)", [
    TokenTypeKind.Quote,
    TokenTypeKind.LParen,
    TokenTypeKind.Number,
    TokenTypeKind.Number,
    TokenTypeKind.Number,
    TokenTypeKind.RParen,
  ]);
});

test('comment', () => {
  assertTokenKinds('1 ; 2 \n\t  3 ', [
    TokenTypeKind.Number,
    TokenTypeKind.Comment,
    TokenTypeKind.Number,
  ]);
});

test('string literal', () => {
  const result = collectTokens('"hello world"');
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, TokenTypeKind.Symbol);
  assert.equal(result[0].value, 'hello world');
});

test('dot token', () => {
  assertTokenKinds('(a . b)', [
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.Dot,
    TokenTypeKind.Symbol,
    TokenTypeKind.RParen,
  ]);
});

test('symbol token', () => {
  const result = collectTokens('foo');
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, TokenTypeKind.Symbol);
  assert.equal(result[0].value, 'foo');
});

test('symbol with numbers', () => {
  const result = collectTokens('abc123');
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, TokenTypeKind.Symbol);
  assert.equal(result[0].value, 'abc123');
});

test('keyword lambda', () => {
  assertTokenKinds('(lambda (x) (+ x 1))', [
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.RParen,
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.Symbol,
    TokenTypeKind.Number,
    TokenTypeKind.RParen,
    TokenTypeKind.RParen,
  ]);
});

test('mixed tokens', () => {
  assertTokenKinds('(lambda (x) (def foo x))', [
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.RParen,
    TokenTypeKind.LParen,
    TokenTypeKind.Symbol,
    TokenTypeKind.Symbol,
    TokenTypeKind.Symbol,
    TokenTypeKind.RParen,
    TokenTypeKind.RParen,
  ]);
});

test('multiple whitespace', () => {
  assertTokenKinds('(  1   2 )', [
    TokenTypeKind.LParen,
    TokenTypeKind.Number,
    TokenTypeKind.Number,
    TokenTypeKind.RParen,
  ]);
});

// === Suite: Parser ===

console.log('\nParser Tests:');

test('parse integer', () => {
  const result = parseToNode('42');
  assert.equal(result.type, 'number');
  assert.equal((result as any).num.intVal, 42);
});

test('parse symbol', () => {
  const result = parseToNode('x');
  assert.equal(result.type, 'symbol');
  assert.equal(symbolToString((result as any).sym), 'x');
});

test('parse + symbol', () => {
  const result = parseToNode('+');
  assert.equal(result.type, 'symbol');
  assert.equal((result as any).sym, BuiltinSymbol.Add);
});

test('parse simple s-expression', () => {
  const result = parseToNode('(+ 1 2)');
  assert.equal(result.type, 'pair');
});

test('parse empty list', () => {
  const result = parseToNode('()');
  assert.equal(result.type, 'symbol');
  assert.equal((result as any).sym, BuiltinSymbol.Nil);
});

test('parse pair', () => {
  const result = parseToNode('(1 . 2)');
  assert.equal(result.type, 'pair');
});

test('parse quoted expression', () => {
  const result = parseToNode("'x");
  assert.equal(result.type, 'pair');
  const p = result as any;
  assert.equal(p.car.node.type, 'specialForm');
  assert.equal(p.car.node.form, SpecialForm.Quote);
});

test('parse comment', () => {
  const result = parseToNode('(;\n);;');
  assert.equal(result.type, 'symbol');
  assert.equal((result as any).sym, BuiltinSymbol.Nil);
});

test('parse invalid syntax', () => {
  const invalidInputs = ['(', ')', '(def x', '(((()(())())', '(1 2 .)', '(. 1)', '(1 . 2 3)', '.'];
  for (const input of invalidInputs) {
    try {
      parse(new Lexer(input));
      throw new Error(`Expected parse error for input: ${input}`);
    } catch {
      // expected
    }
  }
});

// === Suite: Eval ===

console.log('\nEval Tests:');

test('integer literal', () => {
  assertEval('42', n(42));
});

test('simple arithmetic +', () => {
  assertEval('(+ 1 2 3 4)', n(10));
});

test('simple arithmetic -', () => {
  assertEval('(- 3 2 1)', n(0));
});

test('simple arithmetic *', () => {
  assertEval('(* 2 3)', n(6));
});

test('simple arithmetic / integer', () => {
  assertEval('(/ 6 3)', n(2));
});

test('simple arithmetic / float', () => {
  const result = evalToNode('(/ 5 2)');
  assert.equal(result.type, 'number');
  assert.equal((result as any).num.toNumber(), 2.5);
});

test('float arithmetic', () => {
  const result = evalToNode('(+ 1.0 2.0 3)');
  assert.equal(result.type, 'number');
  assert.equal((result as any).num.toNumber(), 6.0);
});

test('nested arithmetic', () => {
  assertEval('(+ (- 1 2) 3)', n(2));
  const result = evalToNode('(* (/ 1 2) (+ 3 4))');
  assert.equal(result.type, 'number');
  assert.equal((result as any).num.toNumber(), 3.5);
});

test('relational operators', () => {
  assertEval('t', t);
  assertEval('(< 1.0 2)', t);
  assertEval('(< 2 1)', nil);
  assertEval('(> 1 2.0)', nil);
  assertEval('(> (+ 1 1) 1)', t);
  assertEval('(<= 1 1.0)', t);
  assertEval('(<= 1.0 2)', t);
  assertEval('(<= 2 1)', nil);
  assertEval('(>= 1 1)', t);
  assertEval('(>= 1 2)', nil);
  assertEval('(>= 2 1)', t);
});

test('toplevel symbol', () => {
  assertEval('+', builtin(BuiltinSymbol.Add));
  assertEval('-', builtin(BuiltinSymbol.Sub));
  assertEval('*', builtin(BuiltinSymbol.Mul));
  assertEval('/', builtin(BuiltinSymbol.Div));
});

test('error cases', () => {
  assertError('(+ 1)', 'Fewer parameters');
  assertError('(> 1)', 'Expected 2 parameters');
  assertError('(= 1 2 3)', 'Expected 2 parameters');
  assertError('(1 2 3)', 'can not be the head');

  const env = NodeEnv.top();
  env.define('x', ref(n(2)));
  assertError('(+ x y)', 'Symbol y not found', env);
});

test('quote', () => {
  assertEval("'(1 2 3)", list(n(1), n(2), n(3)));
});

test('list', () => {
  assertEval('(list 1 2 3)', list(n(1), n(2), n(3)));
  assertEval('(list 1 2)', list(n(1), n(2)));
  assertEval('(list 1)', list(n(1)));
  assertEval('(list)', nil);
});

test('list manipulation', () => {
  assertEval('(car (list 1 2 3))', n(1));
  assertEval("(cdr '(1 2 3))", list(n(2), n(3)));
  assertEval("(cons 1 (list 2 3))", list(n(1), n(2), n(3)));
});

test('atom?', () => {
  assertEval('(atom? 1)', t);
  assertEval('(atom? (+ 1 2))', t);
  assertEval('(atom? (list 1 2 3))', nil);
  assertEval("(atom? 'a)", t);
  assertEval("(atom? '())", t);
});

test('eq?', () => {
  assertEval('(eq? 1 1)', t);
  assertEval('(eq? (- 2 1) 1)', t);
  assertEval('(eq? 1 2)', nil);
  assertEval("(eq? 'a 'a)", t);
  assertEval("(eq? 'a 'b)", nil);
});

test('number?', () => {
  assertEval('(number? 1)', t);
  assertEval('(number? (+ 1 2))', t);
  assertEval("(number? 'a)", nil);
  assertEval("(number? '())", nil);
});

test('define and lookup', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('(define x 1)', env, macros, nil);
  assertEvalInEnv('(define y (+ x 1))', env, macros, nil);
  assertEvalInEnv('x', env, macros, n(1));
  assertEvalInEnv('y', env, macros, n(2));
});

test('set!', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('(define x 1)', env, macros, nil);
  assertEvalInEnv('x', env, macros, n(1));
  assertEvalInEnv('(set! x 2)', env, macros, nil);
  assertEvalInEnv('x', env, macros, n(2));
});

test('lambda call', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('((lambda (x) (+ x 1)) 2)', env, macros, n(3));
  assertEvalInEnv('((lambda (x y) (+ x y)) 2 3)', env, macros, n(5));
});

test('define function', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('(define x 1)', env, macros, nil);
  assertEvalInEnv('(define func (lambda (x) (+ x 1)))', env, macros, nil);
  assertEvalInEnv('(func 2)', env, macros, n(3));
  assertEvalInEnv('(func x)', env, macros, n(2));
});

test('define sugar', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('(define (f) 1)', env, macros, nil);
  assertEvalInEnv('(define (g) (define (f x) x) (f 2))', env, macros, nil);
  assertEvalInEnv('(g)', env, macros, n(2));
});

test('cond', () => {
  assertEval('(cond ((< 1 2) 1) ((> 1 2) 2))', n(1));
  assertEval('(cond ((> 1 2) 1) ((< 1 2) 2))', n(2));
  assertEval('(cond ((> 1 2) 1))', nil);
});

test('and', () => {
  assertEval('(and)', t);
  assertEval("(and '() 2 3)", nil);
  assertEval('(and 1 2 3)', n(3));
});

test('or', () => {
  assertEval('(or)', nil);
  assertEval("(or '() 2 3)", n(2));
  assertEval('(or 1 2 3)', n(1));
});

test('if', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('(if 1 2 3)', env, macros, n(2));
  assertEvalInEnv('(if 0 2 3)', env, macros, n(2));
  assertEvalInEnv("(if 't 2 3)", env, macros, n(2));
  assertEvalInEnv("(if '() 2 3)", env, macros, n(3));
});

test('begin', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv('(begin 1 2 3)', env, macros, n(3));
  assertEvalInEnv('(begin (define x 1) (define y 2) x)', env, macros, n(1));
  assertEvalInEnv('y', env, macros, n(2));
});

test('let', () => {
  assertEval('(let ((x 1) (y 2)) (+ x y))', n(3));
});

test('factorial', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv(`
(define fact
  (lambda (n acc)
    (cond ((< n 2) acc)
          ('t (fact (- n 1) (* n acc))))))`, env, macros, nil);
  assertEvalInEnv('(fact 5 1)', env, macros, n(120));
});

test('fibonacci', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv(`
(define fib
  (lambda (n)
    (cond ((< n 2) 1)
          ('t (+ (fib (- n 1)) (fib (- n 2)))))))`, env, macros, nil);
  assertEvalInEnv('(fib 9)', env, macros, n(55));
});

test('define-syntax-rule', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv("(define-syntax-rule (macro1 x) (display 1) (+ x 1))", env, macros, nil);
  assertEvalInEnv("(define-syntax-rule (macro2 x) (car x))", env, macros, nil);
  assertEvalInEnv('(macro1 2)', env, macros, n(3));
  assertEvalInEnv("(macro2 '(1 2 3))", env, macros, n(1));
});

test('lambda pattern matching', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv("(define f (lambda x (car x)))", env, macros, nil);
  assertEvalInEnv("(f 'a 'b 3 4)", env, macros, sym('a'));
  assertEvalInEnv("(define (g . x) (car x))", env, macros, nil);
  assertEvalInEnv("(g 2 3 4)", env, macros, n(2));
  assertEvalInEnv("(define h (lambda (x . y) (car y)))", env, macros, nil);
  assertEvalInEnv("(h 1 2 3 4)", env, macros, n(2));
  assertEvalInEnv("(h 1 2)", env, macros, n(2));
  assertEvalInEnv("(h 1 't)", env, macros, t);
});

test('set-car!', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv("(define x '(1 2 3))", env, macros, nil);
  assertEvalInEnv("(set-car! x 4)", env, macros, nil);
  const xResult = evalToNode('x', env, macros);
  assert.notEqual(xResult.type, 'symbol'); // should be a pair now
  if (xResult.type === 'pair') {
    assertNodeEqual(xResult.car.node, n(4));
  }
});

test('set-cdr!', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv("(define x '(1 2 3))", env, macros, nil);
  assertEvalInEnv("(set-cdr! x '(4 5 6))", env, macros, nil);
  const xResult = evalToNode('x', env, macros);
  if (xResult.type === 'pair') {
    const cdr = xResult.cdr.node;
    if (cdr.type === 'pair') {
      assertNodeEqual(cdr.car.node, n(4));
    }
  }
});

test('nested list', () => {
  assertEval('(list (list 1 2 3) (list 4 5 6))',
    list(list(n(1), n(2), n(3)), list(n(4), n(5), n(6))));
});

test('quote with list', () => {
  assertEval("'(1 2 3)", list(n(1), n(2), n(3)));
});

test('reverse list', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv(`
(define reverse
  (lambda (x)
    (begin
      (define loop
        (lambda (x y)
          (cond ((eq? x '()) y)
                ('t (begin
                    (define temp (cdr x))
                    (set-cdr! x y)
                    (loop temp x))))))
      (loop x '()))))`, env, macros, nil);
  const result = evalToNode("(reverse '(1 2 3 4))", env, macros);
  assertNodeEqual(result, list(n(4), n(3), n(2), n(1)), 'reverse result');
});

test('delay and force', () => {
  const env = NodeEnv.top();
  const macros = new Map();
  assertEvalInEnv("(define-syntax-rule (delay exp) (lambda () exp))", env, macros, nil);
  assertEvalInEnv("(define (force delayed-object) (delayed-object))", env, macros, nil);
  assertEvalInEnv("(force (delay 1))", env, macros, n(1));
});

// === Results ===

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
