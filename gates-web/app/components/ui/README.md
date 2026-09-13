# Gates Web UI (`app/components/ui`)

Single source of truth for layout, tables, actions, and status indicators. **Use these instead of one-off markup.**

## Actions
| Component | Use for |
|-----------|---------|
| `Button` (`button.tsx`) | Primary / secondary / danger / ghost; `isLoading`, icons |
| `IconButton` | Toolbar & table row actions (Lucide only) |
| `ActionButtons` | Standard **تراجع** + **حفظ** footer pair |

## Data display
| Component | Use for |
|-----------|---------|
| `AppTable` / `DataTable` | All list grids — sticky header, zebra rows, empty state |
| `TablePagination` | Page size + prev/next + row counts |
| `TableSkeleton` | Loading placeholder |
| `EmptyState` | Zero rows / no search results |

## Status & permissions
| Component | Use for |
|-----------|---------|
| `StatusBadge` | Posted / draft / void / active (tone + Lucide icon) |
| `PermissionBadge` | `granted={boolean}` + label |

## Page shell
| Component | Use for |
|-----------|---------|
| `PageHeader` | Title, breadcrumbs, action slot |
| `FormCard` | Card body + optional title/footer |
| `FilterToolbar` | Debounced search + filter slots |

## Tokens
`design-tokens.ts` — accent `#0E78AA`, borders, focus ring.

## Migration
1. Replace raw `<table>` with `AppTable` + column defs.
2. Replace custom save/cancel buttons with `ActionButtons` or `Button`.
3. Replace inline checkmarks with `StatusBadge` / `PermissionBadge`.
4. Use **Lucide React** only for new icons (`lucide-react`).

Import barrel:

```tsx
import { AppTable, PageHeader, Button, StatusBadge } from '@/components/ui';
```
