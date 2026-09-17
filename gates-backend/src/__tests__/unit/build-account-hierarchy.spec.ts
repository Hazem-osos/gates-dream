import {
  buildAccountHierarchyTree,
  type FlatAccountForHierarchy,
} from '../../modules/accounting/utils/build-account-hierarchy';

function row(
  id: string,
  code: string,
  parentId: string | null
): FlatAccountForHierarchy {
  return {
    id,
    code,
    arabicName: id,
    englishName: null,
    accountType: 'asset',
    accountSide: 'مدين',
    parentId,
    accountKind: 'HEADER',
  };
}

describe('buildAccountHierarchyTree cycles', () => {
  it('treats a self-parent as a root instead of looping', () => {
    const tree = buildAccountHierarchyTree([row('a', '1', 'a')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('a');
    expect(tree[0].children).toBeUndefined();
  });

  it('breaks A↔B parent cycles and still returns both accounts', () => {
    const tree = buildAccountHierarchyTree([row('a', '1', 'b'), row('b', '2', 'a')]);
    const ids = tree.flatMap((node) => [node.id, ...(node.children ?? []).map((c) => c.id)]);
    expect(ids.sort()).toEqual(['a', 'b']);
    const nested = tree.some((node) =>
      (node.children ?? []).some((child) => (child.children ?? []).some((g) => g.id === node.id))
    );
    expect(nested).toBe(false);
  });
});
