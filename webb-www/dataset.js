/*
	Dataset.
	Written by Cosmin Apreutesei. Public Domain.

	dataset.validators  : {type -> f}
	dataset.converters  : {type -> f}
	dataset.comparators : {type -> f}

	d.fields: [{attr->val}, ...]
		name           :
		type           : for type-based validators and converters.
		client_default : default value that new rows are initialized with.
		server_default : default value that the server sets.
		allow_null     : allow null.
		read_only      : cannot edit.
		validate_val   : f(field, v) -> true|err
		validate_row   : f(row) -> true|err
		convert_val    : f(field, s) -> v
		comparator     : f(field) -> f(v1, v2) -> -1|0|1

	d.rows: [{attr->val}, ...]
		values         : [v1,...]
		is_new         : new row, not added on server yet.
		removed        : removed row, not removed on server yet.
		old_values     : original values on an updated but not yet saved row.

	d.order_by: 'field_name1[:desc] ...'

	^d.value_changed(row, field, val)
	^d.row_added(ri)
	^d.row_removed(ri)

	d.add_row()
	d.remove_row()

*/

let dataset = function(...options) {

	let d = {
		can_add_rows: true,
		can_remove_rows: true,
		can_change_rows: true,
	}

	let fields // [fi: {name:, client_default: v, server_default: v, ...}]
	let rows   // [ri: row]; row = {values: [fi: val], attr: val, ...}
	let field_map = new Map()

	install_events(d)

	let init = function() {

		// set options/override.
		update(d, ...options)

		// add missing state.
		d.validators  = update({}, dataset.validators , d.validators)
		d.converters  = update({}, dataset.converters , d.converters)
		d.comparators = update({}, dataset.comparators, d.comparators)

		d.fields = d.fields || []
		d.rows = d.rows || []

		// init locals.
		fields = d.fields
		rows = d.rows

		for (let i = 0; i < fields.length; i++) {
			let field = fields[i]
			field.index = i
			field_map.set(field.name, field)
		}

	}

	d.field = function(name) {
		return field_map.get(name)
	}

	// get/set row values -----------------------------------------------------

	d.val = function(row, field) {
		let get_value = field.get_value // computed value?
		return get_value ? get_value(field, row, fields) : row.values[field.index]
	}

	d.validate_val = function(field, val) {
		if (val == '' || val == null)
			return field.allow_null || 'NULL not allowed'
		let validate = field.validate || d.validators[field.type]
		if (!validate)
			return true
		return validate.call(d, val, field)
	}

	d.validate_row = return_true // stub

	d.convert_val = function(field, val) {
		let convert = field.convert || d.converters[field.type]
		return convert ? convert.call(d, val, field) : val
	}

	// NOTE: must be able to compare invalid values as well.
	function default_cmp(v1, v2) {
		if ((typeof v1) < (typeof v2)) return -1
		if ((typeof v1) > (typeof v2)) return  1
		if (v1 !== v1) return v2 !== v2 ? 0 : -1 // NaNs come first
		if (v2 !== v2) return 1 // NaNs come first
		return v1 < v2 ? -1 : (v1 > v2 ? 1 : 0)
	}
	d.comparator = function(field) {
		return field.compare || d.comparators[field.type] || default_cmp
	}

	d.can_change_cell = function(row, field) {
		return d.can_change_rows && !row.read_only && !field.read_only
	}

	d.setval = function(row, field, val) {

		if (!d.can_change_cell(row, field))
			return 'read only'

		// convert value to internal represenation.
		val = d.convert_val(field, val)

		// validate converted value and the entire row with the new value in it.
		let ret = d.validate_val(field, val)
		if (ret !== true)
			return ret
		ret = d.validate_row(row)
		if (ret !== true)
			return ret

		// save old values if not already saved and the row is not new.
		if (!row.old_values)
			row.old_values = row.values.slice(0)

		// set the value.
		row.values[field.index] = val

		// trigger changed event.
		d.trigger('value_changed', [row, field, val])

		return true
	}

	// add/remove rows --------------------------------------------------------

	function create_row() {
		let values = []
		// add server_default values or null
		for (let field of fields) {
			let val = field.server_default
			values.push(val != null ? val : null)
		}
		let row = {values: values, is_new: true}
		// set default client values.
		for (let field of fields)
			d.setval(row, field, field.client_default)
		return row
	}

	d.add_row = function() {
		if (!d.can_add_rows)
			return
		let row = create_row()
		rows.push(row)
		d.trigger('row_added', [row])
		return row
	}

	d.can_remove_row = function(row) {
		if (!d.can_remove_rows)
			return false
		if (row.can_remove === false)
			return false
		return true
	}

	d.remove_row = function(row) {
		if (!d.can_remove_row(row))
			return
		if (row.is_new) {
			rows.remove(rows.indexOf(row))
		} else {
			// mark row as removed
			row.removed = true
		}
		d.trigger('row_removed', [row])
		return row
	}

	// changeset --------------------------------------------------------------

	d.oldval = function(row, field) {
		let values = row.old_values || row.values
		return values[field.index]
	}

	d.val_changed = function(row, field) {
		let old = row.old_values
		return old && old[field.index] !== row.values[field.index]
	}

	// saving

	init()

	return d
}

// validators ----------------------------------------------------------------

dataset.validators = {
	number: function(val, field) {
		val = parseFloat(val)
		return typeof(val) == 'number' && val === val || 'invalid number'
	},
}

dataset.converters = {
	number: function(val, field) {
		if (val == '' || val == null)
			return null
		return parseFloat(val)
	},
	boolean: function(val, field) {
		return !!val
	},
}

dataset.comparators = {

}
