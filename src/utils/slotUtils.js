/**
 * Utility functions for managing hierarchical slot structure using parentId relationships
 */

// Slot Manager for parentId-based hierarchy
export class SlotManager {
  static generateSlotId(type = 'slot') {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  static getRootSlots(slots) {
    if (!slots || typeof slots !== 'object') return [];
    return Object.values(slots)
      .filter(slot => slot.parentId === null)
      .sort((a, b) => (a.position?.row || 0) - (b.position?.row || 0));
  }

  static getChildSlots(slots, parentId) {
    if (!slots || typeof slots !== 'object') return [];
    const allSlots = Object.values(slots);
    const childSlots = allSlots.filter(slot => slot.parentId === parentId);

    // Sort by position.row, fallback to 0
    const sorted = childSlots.sort((a, b) => (a.position?.row || 0) - (b.position?.row || 0));
    return sorted;
  }
  
  static moveSlot(slots, slotId, newParentId, newPosition) {
    const slot = slots[slotId];
    if (!slot) return slots;
    
    // Simply update the slot's parent and position
    slot.parentId = newParentId;
    slot.position = newPosition;
    slot.metadata = slot.metadata || {};
    slot.metadata.lastModified = new Date().toISOString();
    
    return { ...slots };
  }
  
  static createSlot(type, parentId = null, position = { col: 1, row: 0 }) {
    return {
      id: this.generateSlotId(type),
      type,
      content: '',
      parentId,
      position,
      className: '',
      styles: {},
      metadata: {
        name: `New ${type}`,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };
  }
  
  static deleteSlot(slots, slotId) {
    const newSlots = { ...slots };
    
    // Recursively delete children using parentId relationships
    const deleteRecursive = (id) => {
      const childSlots = this.getChildSlots(newSlots, id);
      childSlots.forEach(child => deleteRecursive(child.id));
      delete newSlots[id];
    };
    
    deleteRecursive(slotId);
    return newSlots;
  }
  
  static renderSlotHierarchy(slots, parentId = null, level = 0) {
    const childSlots = this.getChildSlots(slots, parentId);
    return childSlots.map(slot => ({
      ...slot,
      level,
      children: this.renderSlotHierarchy(slots, slot.id, level + 1)
    }));
  }
}

export default SlotManager;