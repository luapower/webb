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
		validate       : f(v, field) -> true|err
		convert        : f(s, field) -> v
		compare        : f(a, b) -> -1|0|1

	d.rows: [{attr->val}, ...]
		values         : [v1,...]
		is_new         : new row, not added on server yet.
		deleted        : deleted row, not deleted on server yet.
		old_values     : original values on an updated but not yet saved row.

	d.order_by: 'field_name1[:desc] ...'

	^d.value_changed(row, field, val)
	^d.row_added(ri)
	^d.row_removed(ri)

*/

let dataset = function(...options) {

	let d = install_events({})
	let fields // [fi: {name:, client_default: v, server_default: v, ...}]
	let rows   // [ri: row]; row = {values: [fi: val], attr: val, ...}
	let field_map = new Map()

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

		// init events
		// let ev = $(d)
		// d.on = $.proxy(ev.on, ev)
		// d.trigger = $.proxy(ev.trigger, ev)

		init_order_by()

	}

	d.field = function(name) {
		return field_map.get(name)
	}

	// get/set row values -----------------------------------------------------

	d.val = function(row, field) {
		let get_value = field.get_value // computed value?
		return get_value ? get_value(field, row, fields) : row.values[field.index]
	}

	d.validate_val = function(val, field) {
		let validate = field.validate || d.validators[field.type]
		if (!validate)
			return true
		return validate.call(d, val, field)
	}

	d.validate_row = return_true // stub

	d.convert_val = function(val, field) {
		let convert = field.convert || d.converters[field.type]
		return convert ? convert.call(d, val, field) : val
	}

	d.setval = function(row, field, val) {

		// convert value to internal represenation.
		val = d.convert_val(val, field)

		// validate converted value and the entire row with the new value in it.
		let ret = d.validate_val(val, field)
		if (ret !== true)
			return ret
		ret = d.validate_row()
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

	d.row = function() {
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

	d.add = function(row) {
		row = row || d.row()
		rows.push(row)
		d.trigger('row_added', [row])
		return row
	}

	d.remove = function(row) {
		if (row.is_new) {
			rows.remove(rows.indexOf(row))
		} else {
			// mark row as deleted
			row.deleted = true
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


	// sorting ----------------------------------------------------------------

	let order_by_dir

	function init_order_by() {
		let order_by = d.order_by || ''
		delete d.order_by
		property(d, 'order_by', {
			get: function() {
				let a = []
				for (let [field, dir] of dir_map) {
					a.push(field.name + (dir == 'asc' ? '' : ':desc'))
				}
				return a.join(' ')
			},
			set: function(s) {
				order_by_dir = new Map()
				let ea = s.split(/[\s,]+/)
				for (let e of ea) {
					let m = e.match('^([^\:]*):?(\.*)$')
					let name = m[1]
					let field = d.field(name)
					if (field) {
						let dir = m[2] || 'asc'
						if (dir == 'asc' || dir == 'desc')
							order_by_dir.set(field, dir)
					}
				}
			}
		})
		d.order_by = order_by || ''
		d.sort()
	}

	d.order_by_dir = function(field) {
		return order_by_dir.get(field)
	}

	d.toggle_order = function(field, keep_others) {
		let dir = order_by_dir.get(field)
		dir = dir == 'asc' ? 'desc' : 'asc' // (dir == 'desc' ? null : 'asc')
		if (!keep_others)
			order_by_dir.clear()
		if (!dir)
			order_by_dir.delete(field)
		else
			order_by_dir.set(field, dir)
		d.sort()
	}

	d.clear_order = function() {
		order_by_dir.clear()
		d.sort()
	}

	d.sort = function() {

		if (!order_by_dir.size) {

			rows = d.rows_unordered
			d.rows = rows

		} else {

			if (!d.rows_unordered)
				d.rows_unordered = rows.slice()

			let cmp = []
			for (let [field, dir] of order_by_dir) {
				let i = field.index
				let r = dir == 'asc' ? -1 : 1
				cmp.push('if (r1.values['+i+'] < r2.values['+i+']) return  '+r)
				cmp.push('if (r1.values['+i+'] > r2.values['+i+']) return ' +(-r))
			}
			cmp.push('return 0')
			cmp = 'let f = function(r1, r2) {\n\t' + cmp.join('\n\t') + '\n}; f'
			cmp = eval(cmp)

			rows.sort(cmp)
		}

		d.trigger('reload')

	}

	init()

	return d
}

// validators ----------------------------------------------------------------

dataset.validators = {
	number: function(val, field) {
		val = parseFloat(val)
		return isNaN(val) && 'invalid number' || true
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
