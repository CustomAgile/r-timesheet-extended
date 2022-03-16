/**
 * OVERRIDE - Check that groups exists before calling group.setDirty().
 * If all data has been filtered out, there won't be a group, don't setDirty() on undefined.
 **/
Ext.override(Ext.data.Store, {
    updateGroupsOnUpdate: function(record, modifiedFieldNames){
        var me = this,
            groupField = me.getGroupField(),
            groupName = me.getGroupString(record),
            groups = me.groups,
            len, i, items, group;

        if (modifiedFieldNames && Ext.Array.contains(modifiedFieldNames, groupField)) {

            // Sorting is remote for buffered stores, we cannot update a field which is a sort key
            if (me.buffered) {
                Ext.Error.raise({
                    msg: 'Cannot move records between groups in a buffered store record'
                });
            }

            // First find the old group and remove the record
            items = groups.items;
            for (i = 0, len = items.length; i < len; ++i) {
                group = items[i];
                if (group.contains(record)) {
                    group.remove(record);
                    break;
                }
            }
            group = groups.getByKey(groupName);
            if (!group) {
                group = groups.add(new Ext.data.Group({
                    key: groupName,
                    store: me
                }));
            }
            group.add(record);

            // At this point we know that we're sorted, so re-insert the record.
            // Without adding to the "removed" list or firing events!
            me.data.remove(record);
            me.data.insert(me.data.findInsertionIndex(record, me.generateComparator()), record);

        } else {
            /** OVERRIDE **/
            // some other field changed, just mark the group as dirty
            var group = groups.getByKey(groupName);
            if ( group ) {
                group.setDirty();
            }
        }
    }
})