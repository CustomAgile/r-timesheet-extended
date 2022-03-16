Ext.override(Ext.selection.CheckboxModel,{
    onHeaderClick: function(headerCt, header, e) {
        // force open all if checking.
        var view = this.view;

        view.features[0].expandAll();
        
        if (header.isCheckerHd) {
            e.stopEvent();
            var me = this,
                isChecked = header.el.hasCls(Ext.baseCSSPrefix + 'grid-hd-checker-on');
                
            // Prevent focus changes on the view, since we're selecting/deselecting all records
            me.preventFocus = true;
            if (isChecked) {
                me.deselectAll();
            } else {
                me.selectAll();
            }
            delete me.preventFocus;
        }
    }
});
