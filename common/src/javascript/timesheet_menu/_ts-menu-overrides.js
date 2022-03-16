Ext.override(Rally.ui.grid.CheckboxModel, {
    _recordIsSelectable: function(record) {
        return true;
    }
});