# Panel Structure Issue

## Problem:
Nested ResizablePanelGroups cause percentage compounding:
- Chat: 3% of viewport ✓
- Wrapper: 97% of viewport
  - File: 3% of wrapper = 2.91% of viewport ❌ (should be 3%)
  - Editor: 94% of wrapper = 91.18% of viewport ❌ (should be 94%)

## Solution:
Flatten to ONE ResizablePanelGroup with THREE siblings:

```jsx
<ResizablePanelGroup>
  <ResizablePanel> {/* Chat */} </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel> {/* File Tree */} </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel> {/* Editor */} </ResizablePanel>
</ResizablePanelGroup>
```

This way all percentages are direct % of viewport, no compounding.

Need to extract FileTree and Editor into separate components or inline them.
