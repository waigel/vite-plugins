import { sortBy, tinyassert } from "@hiogawa/utils";
import { getPathPrefixes } from "./utils";

// generate tree from glob entries such as generated by
//   import.meta.glob("/**/(page|layout|...).(js|jsx|ts|tsx)")
export function createFsRouteTree<T>(globEntries: Record<string, unknown>): {
  entries: Record<string, T>;
  tree: TreeNode<T>;
} {
  const entries: Record<string, T> = {};
  for (const [k, v] of Object.entries(globEntries)) {
    const m = k.match(
      /^(.*)\/(page|layout|error|not-found|loading|template|route)\.\w*$/,
    );
    tinyassert(m && 1 in m && 2 in m);
    const pathname = m[1] || "/";
    (entries[pathname] ??= {} as any)[m[2]] = v;
  }

  const flatTree = Object.entries(entries).map(([k, v]) => ({
    keys: k.replace(/\/+$/, "").split("/"),
    value: v,
  }));
  const tree = createTree(flatTree);

  // sort to match static route first before dynamic route
  sortDynamicRoutes(tree);

  return { entries, tree };
}

function sortDynamicRoutes<T>(tree: TreeNode<T>) {
  if (tree.children) {
    tree.children = Object.fromEntries(
      sortBy(Object.entries(tree.children), ([k]) => k.includes("[")),
    );
    for (const v of Object.values(tree.children)) {
      sortDynamicRoutes(v);
    }
  }
}

export type MatchParamEntry = [key: string | null, value: string];
export type MatchParams = Record<string, string>;

export function toMatchParamsObject(params: MatchParamEntry[]): MatchParams {
  let result: MatchParams = {};
  for (const [k, v] of params) {
    if (k) {
      result[k] = v;
    }
  }
  return result;
}

export type MatchNodeEntry<T> = {
  prefix: string;
  type: "layout" | "page";
  node: TreeNode<T>;
  params: MatchParamEntry[];
};

export type MatchResult<T> = {
  matches: MatchNodeEntry<T>[];
  params: MatchParamEntry[];
};

export function matchRouteTree<T>(
  tree: TreeNode<T>,
  pathname: string,
): MatchResult<T> {
  const prefixes = getPathPrefixes(pathname);

  let node = tree;
  let params: MatchParamEntry[] = [];
  const matches: MatchNodeEntry<T>[] = [];
  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i]!;
    const segment = prefix.split("/").at(-1)!;
    const next = matchRouteChild(segment, node);
    if (next?.child) {
      node = next.child;
      if (next.catchAll) {
        const rest = pathname.slice(prefixes[i - 1]!.length + 1);
        params = [...params, [next.param, decodeURI(rest)]];
        matches.push({ prefix, type: "layout", node, params });
        for (const prefix of prefixes.slice(i + 1)) {
          matches.push({
            prefix,
            type: "layout",
            node: initTreeNode(),
            params,
          });
        }
        matches.push({ prefix: pathname, type: "page", node, params });
        break;
      }
      if (next.param) {
        params = [...params, [next.param, decodeURI(segment)]];
      } else {
        params = [...params, [null, decodeURI(segment)]];
      }
    } else {
      node = initTreeNode();
    }
    matches.push({ prefix, type: "layout", node, params });
    if (prefix === pathname) {
      matches.push({ prefix, type: "page", node, params });
    }
  }
  return { matches, params };
}

const DYNAMIC_RE = /^\[(\w*)\]$/;
const CATCH_ALL_RE = /^\[\.\.\.(\w*)\]$/;

export function matchRouteChild<T>(input: string, node: TreeNode<T>) {
  if (!node.children) {
    return;
  }
  for (const [segment, child] of Object.entries(node.children)) {
    const mAll = segment.match(CATCH_ALL_RE);
    if (mAll) {
      tinyassert(1 in mAll);
      return { param: mAll[1], child, catchAll: true };
    }
    const m = segment.match(DYNAMIC_RE);
    if (m) {
      tinyassert(1 in m);
      return { param: m[1], child };
    }
    if (segment === input) {
      return { child };
    }
  }
  return;
}

export function parseRoutePath(pathname: string) {
  const dynamicMap: Record<string, string> = {};

  for (const segment of pathname.split("/")) {
    const mAll = segment.match(CATCH_ALL_RE);
    if (mAll) {
      tinyassert(1 in mAll);
      mAll[1];
      dynamicMap[mAll[1]] = segment;
    }
    const m = segment.match(DYNAMIC_RE);
    if (m) {
      tinyassert(1 in m);
      dynamicMap[m[1]] = segment;
    }
  }

  function format(params: Record<string, string>): string {
    let result = pathname;
    tinyassert(
      isEqualArrayShallow(
        Object.keys(dynamicMap).sort(),
        Object.keys(params).sort(),
      ),
    );
    for (const [k, v] of Object.entries(params)) {
      const segment = dynamicMap[k];
      tinyassert(segment);
      result = result.replace(segment, v);
    }
    return result;
  }

  return {
    dynamic: Object.keys(dynamicMap).length > 0,
    format,
  };
}

function isEqualArrayShallow(xs: unknown[], ys: unknown[]) {
  return xs.length === ys.length && xs.every((x, i) => x === ys[i]);
}

//
// general tree utils copied from vite-glob-routes
// https://github.com/hi-ogawa/vite-plugins/blob/c2d22f9436ef868fc413f05f243323686a7aa143/packages/vite-glob-routes/src/react-router/route-utils.ts#L15-L22
//

export type TreeNode<T> = {
  value?: T;
  children?: Record<string, TreeNode<T>>;
};

export function initTreeNode<T>(): TreeNode<T> {
  return {};
}

function createTree<T>(entries: { value: T; keys: string[] }[]): TreeNode<T> {
  const root = initTreeNode<T>();

  for (const e of entries) {
    let node = root;
    for (const key of e.keys) {
      node = (node.children ??= {})[key] ??= initTreeNode();
    }
    node.value = e.value;
  }

  return root;
}
