// Success Page Slot Configuration
// Backend version - CommonJS format

const successConfig = {
  page_name: "Success",
  slot_type: "success_layout",
  slots: {
    main_layout: {
      id: "main_layout",
      type: "container",
      content: "",
      className: "min-h-screen bg-gray-50",
      parentClassName: "",
      styles: {
        minHeight: "100vh",
        backgroundColor: "#f9fafb"
      },
      parentId: null,
      layout: null,
      gridCols: null,
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    header_container: {
      id: "header_container",
      type: "container",
      content: "",
      className: "w-full bg-white shadow-sm",
      parentClassName: "",
      styles: {
        width: "100%",
        backgroundColor: "white",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      },
      parentId: "main_layout",
      position: { col: 1, row: 1 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    success_content: {
      id: "success_content",
      type: "container",
      content: "",
      className: "max-w-4xl mx-auto px-4 py-8",
      parentClassName: "",
      styles: {
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "2rem 1rem"
      },
      parentId: "main_layout",
      position: { col: 1, row: 2 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    success_icon: {
      id: "success_icon",
      type: "container",
      content: "",
      className: "text-center mb-6",
      parentClassName: "text-center",
      styles: {
        textAlign: "center",
        marginBottom: "1.5rem"
      },
      parentId: "success_content",
      position: { col: 1, row: 1 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    success_title: {
      id: "success_title",
      type: "text",
      content: "Order Confirmed!",
      className: "text-3xl font-bold text-green-600 mb-2",
      parentClassName: "text-center",
      styles: {
        fontSize: "1.875rem",
        fontWeight: "bold",
        color: "#059669",
        marginBottom: "0.5rem"
      },
      parentId: "success_content",
      position: { col: 1, row: 2 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    success_message: {
      id: "success_message",
      type: "text",
      content: "Thank you for your purchase! Your order has been successfully placed.",
      className: "text-lg text-gray-600 mb-6",
      parentClassName: "text-center",
      styles: {
        fontSize: "1.125rem",
        color: "#4b5563",
        marginBottom: "1.5rem"
      },
      parentId: "success_content",
      position: { col: 1, row: 3 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    order_details: {
      id: "order_details",
      type: "container",
      content: "",
      className: "bg-white rounded-lg shadow-md p-6 mb-6",
      parentClassName: "",
      styles: {
        backgroundColor: "white",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "1.5rem",
        marginBottom: "1.5rem"
      },
      parentId: "success_content",
      position: { col: 1, row: 4 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    order_number: {
      id: "order_number",
      type: "text",
      content: "Order #12345",
      className: "text-xl font-semibold text-gray-900 mb-4",
      parentClassName: "",
      styles: {
        fontSize: "1.25rem",
        fontWeight: "600",
        color: "#111827",
        marginBottom: "1rem"
      },
      parentId: "order_details",
      position: { col: 1, row: 1 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    order_summary: {
      id: "order_summary",
      type: "container",
      content: "",
      className: "space-y-2",
      parentClassName: "",
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      },
      parentId: "order_details",
      position: { col: 1, row: 2 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    actions_container: {
      id: "actions_container",
      type: "container",
      content: "",
      className: "flex flex-col sm:flex-row gap-4 justify-center",
      parentClassName: "text-center",
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        justifyContent: "center"
      },
      parentId: "success_content",
      position: { col: 1, row: 5 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    continue_shopping_button: {
      id: "continue_shopping_button",
      type: "button",
      content: "Continue Shopping",
      className: "btn-themed text-white px-6 py-3 rounded-md transition-colors",
      parentClassName: "",
      styles: {
        backgroundColor: "{{settings.theme.primary_button_color}}",
        color: "white",
        padding: "0.75rem 1.5rem",
        borderRadius: "0.375rem",
        cursor: "pointer",
        transition: "filter 0.2s"
      },
      parentId: "actions_container",
      position: { col: 1, row: 1 },
      colSpan: 6,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    view_order_button: {
      id: "view_order_button",
      type: "button",
      content: "View Order Details",
      className: "bg-gray-200 text-gray-800 px-6 py-3 rounded-md hover:bg-gray-300 transition-colors",
      parentClassName: "",
      styles: {
        backgroundColor: "#e5e7eb",
        color: "#1f2937",
        padding: "0.75rem 1.5rem",
        borderRadius: "0.375rem",
        cursor: "pointer",
        transition: "background-color 0.2s"
      },
      parentId: "actions_container",
      position: { col: 1, row: 2 },
      colSpan: 6,
      rowSpan: 1,
      viewMode: ["withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    },
    footer_container: {
      id: "footer_container",
      type: "container",
      content: "",
      className: "w-full bg-gray-100 mt-auto",
      parentClassName: "",
      styles: {
        width: "100%",
        backgroundColor: "#f3f4f6",
        marginTop: "auto"
      },
      parentId: "main_layout",
      position: { col: 1, row: 3 },
      colSpan: 12,
      rowSpan: 1,
      viewMode: ["empty", "withOrder"],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true
      }
    }
  },
  metadata: {
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    version: "1.0",
    pageType: "success"
  },

  views: [
    { id: 'empty', label: 'Empty State', icon: null },
    { id: 'withOrder', label: 'With Order Details', icon: null }
  ],

  cmsBlocks: [
    'success_header',
    'success_banner',
    'success_footer',
    'success_upsell'
  ]
};

module.exports = { successConfig };
