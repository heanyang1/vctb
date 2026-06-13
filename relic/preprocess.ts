import {
  NodeData, NodeRef, nilNode, nilRef, ref, pairRef,
  Pattern, patternFromNode, patternMatching,
  vectorize, deepCopy, replaceNode, nodeEqual,
  withBegin, nodeFromIter,
} from './node.js';
import { SpecialForm, BuiltinSymbol } from './symbol.js';

interface Macro {
  pattern: Pattern;
  template: NodeData;
}

export function preprocess(node: NodeData, macros: Map<string, Macro>): NodeData {
  if (node.type === 'procedure') throw new Error('Cannot preprocess procedure');
  if (node.type === 'number' || node.type === 'symbol' || node.type === 'specialForm') {
    return deepCopy(node);
  }

  const car = preprocess(node.car.node, macros);
  const cdr = preprocess(node.cdr.node, macros);

  if (car.type === 'symbol' && typeof car.sym === 'object' && car.sym.kind === 'user') {
    const macro = macros.get(car.sym.name);
    if (macro) {
      const params = vectorize(ref(cdr));
      const bindings = new Map<string, NodeRef>();
      patternMatching(macro.pattern, params, bindings);
      const body = deepCopy(macro.template);
      for (const [name, param] of bindings) {
        replaceNode(body, { type: 'symbol', sym: { kind: 'user', name } }, param.node);
      }
      return body;
    }
  }

  if (car.type === 'specialForm') {
    switch (car.form) {
      case SpecialForm.DefineSyntaxRule: {
        const pair = cdr.type === 'pair' ? cdr : null;
        if (!pair) throw new Error('Invalid define-syntax-rule');
        const symNode = pair.car.node;
        const symPair = symNode.type === 'pair' ? symNode : null;
        if (!symPair) throw new Error('Invalid define-syntax-rule syntax');
        const name = symPair.car.node.type === 'symbol' && typeof symPair.car.node.sym === 'object' && symPair.car.node.sym.kind === 'user'
          ? symPair.car.node.sym.name : null;
        if (!name) throw new Error('Invalid macro name');
        const pattern = patternFromNode(symPair.cdr.node);
        const bodyVal = cdr.type === 'pair' ? cdr.cdr : nilRef();
        macros.set(name, { pattern, template: withBegin(bodyVal.node) });
        return nilNode();
      }
      case SpecialForm.Define: {
        const pair = cdr.type === 'pair' ? cdr : null;
        if (!pair) throw new Error('Invalid define');
        const pattern = pair.car.node;
        if (pattern.type === 'pair') {
          const func = pattern.car;
          const params = pattern.cdr;
          const body = pair.cdr;
          return {
            type: 'pair',
            car: ref(car),
            cdr: ref({
              type: 'pair',
              car: func,
              cdr: ref({
                type: 'pair',
                car: ref({ type: 'pair', car: ref({ type: 'specialForm', form: SpecialForm.Lambda }), cdr: ref({ type: 'pair', car: params, cdr: ref(body.node) }) }),
                cdr: nilRef(),
              }),
            }),
          };
        }
        return { type: 'pair', car: ref(car), cdr: ref(cdr) };
      }
      case SpecialForm.Cond: {
        const params = vectorize(ref(cdr));
        let body: NodeData = nilNode();
        for (let i = params.length - 1; i >= 0; i--) {
          const pair = params[i].node;
          if (pair.type !== 'pair') throw new Error('Invalid cond clause');
          const cond = pair.car;
          const value = pair.cdr;
          body = {
            type: 'pair',
            car: ref({ type: 'specialForm', form: SpecialForm.If }),
            cdr: ref({
              type: 'pair',
              car: cond,
              cdr: ref({
                type: 'pair',
                car: ref({ type: 'pair', car: ref({ type: 'specialForm', form: SpecialForm.Begin }), cdr: value }),
                cdr: ref({ type: 'pair', car: ref(body), cdr: nilRef() }),
              }),
            }),
          };
        }
        return body;
      }
      case SpecialForm.And: {
        const params = vectorize(ref(cdr));
        if (params.length === 0) return { type: 'symbol', sym: BuiltinSymbol.T };
        const last = params[params.length - 1];
        let body: NodeData = {
          type: 'pair',
          car: ref({ type: 'specialForm', form: SpecialForm.If }),
          cdr: ref({
            type: 'pair',
            car: ref({ type: 'pair', car: ref({ type: 'symbol', sym: BuiltinSymbol.Eq }), cdr: ref({ type: 'pair', car: last, cdr: ref({ type: 'pair', car: nilRef(), cdr: nilRef() }) }) }),
            cdr: ref({ type: 'pair', car: last, cdr: ref({ type: 'pair', car: last, cdr: nilRef() }) }),
          }),
        };
        for (let i = params.length - 2; i >= 0; i--) {
          body = {
            type: 'pair',
            car: ref({ type: 'specialForm', form: SpecialForm.If }),
            cdr: ref({
              type: 'pair',
              car: ref({ type: 'pair', car: ref({ type: 'symbol', sym: BuiltinSymbol.Eq }), cdr: ref({ type: 'pair', car: params[i], cdr: ref({ type: 'pair', car: nilRef(), cdr: nilRef() }) }) }),
              cdr: ref({ type: 'pair', car: params[i], cdr: ref({ type: 'pair', car: ref(body), cdr: nilRef() }) }),
            }),
          };
        }
        return body;
      }
      case SpecialForm.Or: {
        const params = vectorize(ref(cdr));
        let body: NodeData = nilNode();
        for (let i = params.length - 1; i >= 0; i--) {
          body = {
            type: 'pair',
            car: ref({ type: 'specialForm', form: SpecialForm.If }),
            cdr: ref({
              type: 'pair',
              car: params[i],
              cdr: ref({ type: 'pair', car: params[i], cdr: ref({ type: 'pair', car: ref(body), cdr: nilRef() }) }),
            }),
          };
        }
        return body;
      }
      case SpecialForm.Let: {
        if (cdr.type !== 'pair') throw new Error('Invalid let');
        const bindings = cdr.car;
        const body = cdr.cdr;
        const keys: NodeRef[] = [];
        const values: NodeRef[] = [];
        for (const binding of vectorize(bindings)) {
          const bPair = binding.node;
          if (bPair.type !== 'pair') throw new Error('Invalid let binding');
          keys.push(bPair.car);
          const v = bPair.cdr.node;
          if (v.type !== 'pair') throw new Error('Invalid let binding value');
          values.push(v.car);
        }
        const keysNode = nodeFromIter(keys);
        const valuesNode = nodeFromIter(values);
        return {
          type: 'pair',
          car: ref({
            type: 'pair',
            car: ref({ type: 'specialForm', form: SpecialForm.Lambda }),
            cdr: ref({ type: 'pair', car: ref(keysNode), cdr: body }),
          }),
          cdr: ref(valuesNode),
        };
      }
      default:
        return { type: 'pair', car: ref(car), cdr: ref(cdr) };
    }
  }

  return { type: 'pair', car: ref(car), cdr: ref(cdr) };
}
