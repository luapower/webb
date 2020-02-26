/*
	Dataset.
	Written by Cosmin Apreutesei. Public Domain.

	dataset.validators: {type -> f(val, field)}
	dataset.converters: {type -> f(val, field)->val}

	d.fields: [{attr->val}, ...]
		name           :
		type           : for type-based validators and converters.
		client_default : default value that new rows are initialized with.
		server_default : default value that the server sets.
		validate       : custom validator.
		convert        : custom converter.

	d.rows: [{attr->val}, ...]
		values         : [v1,...]
		is_new         : new row, not added on server yet.
		deleted        : deleted row, not deleted on server yet.
		old_values     : original values on an updated but not yet saved row.

	^d.changed(row, field, val)
	^d.row_added(ri)
	^d.row_removed(ri)

*/

function dataset(...options) {

	var d = {}

	// local references

	var fields // [fi: {name:, client_default: v, server_default: v, ...}]
	var rows   // [ri: row]; row = {values: [fi: val], attr: val, ...}

	function init() {

		// set options/override.
		update(d, ...options)

		// add missing state.
		d.validators = d.validators || {}
		d.converters = d.converters || {}
		d.fields = d.fields || []
		d.rows = d.rows || []

		// init locals.
		fields = d.fields
		rows = d.rows

		for (fi in fields)
			fields[fi].index = fi

		// init events
		var ev = $(d)
		d.on = $.proxy(ev.on, ev)
		d.trigger = $.proxy(ev.trigger, ev)

	}

	// get/set row values

	d.val = function(row, field) {
		var get_value = field.get_value // computed value?
		return get_value ? get_value(field, row, fields) : row.values[field.index]
	}

	d.validate = function(val, field) {
		var validate = field.validate || d.validators[field.type]
		if (!validate) return
		validate.call(d, val, field)
	}

	d.convert = function(val, field) {
		var convert = field.convert || d.converters[field.type]
		return convert ? convert.call(d, val, field) : val
	}

	d.setval = function(row, field, val) {

		// convert value to internal represenation.
		val = d.convert(val, field)

		// validate converted value.
		d.validate(val, field)

		// save old values if not already saved and the row is not new.
		if (!row.old_values)
			row.old_values = row.values.slice(0)

		// set the value.
		row.values[field.index] = val

		// trigger changed event.
		d.trigger('value_changed', [row, field, val])

		// return converted value
		return val
	}

	// add/remove rows

	d.row = function() {
		var values = []
		// add server_default values or null
		for (var field of fields) {
			var val = field.server_default
			values.push(val != null ? val : null)
		}
		var row = {values: values, is_new: true}
		// set default client values.
		for (var field of fields)
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

	// changeset

	d.oldval = function(row, field) {
		var values = row.old_values || row.values
		return values[field.index]
	}

	d.val_changed = function(row, field) {
		var old = row.old_values
		return old && old[field.index] !== row.values[field.index]
	}

	init()

	return d
}

// validators ----------------------------------------------------------------

function ValidationError() {
	var e = Error.apply(this, arguments)
	e.name = this.name = 'ValidationError'
	this.stack = e.stack
	this.message = e.message
	return this
}
var IntermediateInheritor = function() {}
IntermediateInheritor.prototype = Error.prototype
ValidationError.prototype = new IntermediateInheritor()

dataset.validators = {
	number: function(val, field) {
		if (parseFloat(val) === undefined)
			throw new ValidationError('invalid number')
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

