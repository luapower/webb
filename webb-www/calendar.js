/*
	Calendar Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

function calendar(...options) {

	let c = {}

	function init() {
		update(c, ...options)
		install_events(c)
		create_view()
		init_date()
		if (c.parent)
			c.parent.add(c.view)
	}

	c.free = function() {
		if (c.parent) {
			c.remove()
			c.parent = null
		}
	}

	let date
	function init_date() {
		date = c.date
		property(c, 'date', {get: get_date, set: set_date})
		c.date = date
	}

	function get_date() { return date; }

	function update_weekview(d, weeks) {
		let today = day(now())
		let this_month = month(d)
		d = week(this_month)
		c.weekview.innerHTML = ''
		for (let week = 0; week <= weeks; week++) {
			let tr = H.tr()
			for (let weekday = 0; weekday < 7; weekday++) {
				if (!week) {
					let th = H.th({class: 'weekday'}, weekday_name(day(d, weekday)))
					tr.add(th)
				} else {
					let m = month(d)
					let s = d == today ? ' today' : ''
					s = s + (m == this_month ? ' current-month' : '')
					s = s + (d == c.date ? ' selected' : '')
					let td = H.td({class: 'day'+s}, floor(1 + days(d - m)))
					td.date = d
					td.on('click', day_click)
					tr.add(td)
					d = day(d, 1)
				}
			}
			c.weekview.add(tr)
		}
	}

	function set_date(t) {
		if (t == null)
			t = now()
		t = day(t)
		if (t != t)
			return
		date = t
		update_weekview(t, 6)
		let y = year_of(t)
		let n = floor(1 + days(t - month(t)))
		c.sel_day.innerHTML = n
		let day_suffixes = ['', 'st', 'nd', 'rd']
		c.sel_day_suffix.innerHTML = locale.startsWith('en') ?
			(n < 11 || n > 13) && day_suffixes[n % 10] || 'th' : ''
		c.sel_month.value = month_name(t, 'long')
		c.sel_year.value = y
	}

	function validate_year(v) {
		let y = Number(v)
		return y >= 1970 && y <= 2200 || 'Year must be between 1970 and 2200'
	}

	function create_view() {
		c.sel_day = H.div({class: 'sel-day'})
		c.sel_day_suffix = H.div({class: 'sel-day-suffix'})
		c.sel_month = input({class: 'sel-month'})
		c.sel_year = input({class: 'sel-year', validate: validate_year})
		c.sel_month.input.on('input', month_changed)
		c.sel_year.input.on('input', year_changed)
		c.sel_year.view.on('wheel', year_input_wheel)
		c.header = H.div({class: 'header'},
			c.sel_day, c.sel_day_suffix,
			c.sel_month.view, c.sel_year.view)
		c.weekview = H.table({class: 'weekview', tabindex: 0})
		c.weekview.on('keydown', weekview_keydown)
		c.weekview.on('wheel', weekview_wheel)
		c.view = H.div({class: 'calendar'}, c.header, c.weekview)
	}

	// controller

	function day_click() {
		c.date = this.date
		c.trigger('value_picked', c.date)
	}

	function month_changed() {
		let d = new Date(c.date)
		d.setMonth(this.value)
		c.date = d.valueOf()
	}

	function year_changed() {
		let d = new Date(c.date)
		d.setYear(this.value)
		c.date = d.valueOf()
	}

	function year_input_wheel(e) {
		let d = new Date(c.date)
		d.setFullYear(d.getFullYear() + sign(e.deltaY))
		c.date = d.valueOf()
	}

	function weekview_wheel(e) {
		let d = new Date(c.date)
		d.setMonth(d.getMonth() + e.deltaY / 100)
		c.date = d.valueOf()
	}

	function weekview_keydown(e) {
		let d
		switch (e.key) {
			case 'ArrowLeft'  : d = -1; break
			case 'ArrowRight' : d =  1; break
			case 'ArrowUp'    : d = -7; break
			case 'ArrowDown'  : d =  7; break
		}
		if (d)
			c.date = day(c.date, d)
	}

	init()

	return c

}

