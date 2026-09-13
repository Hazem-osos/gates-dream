import * as React from "react"
import { cn } from "@/lib/utils"

type TreeProps = React.HTMLAttributes<HTMLDivElement>;

const Tree = React.forwardRef<HTMLDivElement, TreeProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("space-y-2", className)}
      {...props}
    />
  )
)
Tree.displayName = "Tree"

export { Tree } 