
function weekday_name(day, how) {
	let d = new Date(Date.UTC(2010, 1, 6 + day, 0, 0, 0))
	return d.toLocaleDateString(undefined, {weekday: how || 'short'})
}

function month_name(month, how) {
	let d = new Date(Date.UTC(2010, month, 1, 0, 0, 0))
	return d.toLocaleDateString(undefined, {month: how || 'short'})
}

function calendar(...options) {

	let c = {}

	function init() {
		update(c, ...options)
		create()
	}

	function create_weekview(d, weeks) {
		let today = day(now())
		let this_month = month(d)
		d = week(this_month)
		let table = H.table({class: 'calendar-weekview-table'})
		for (let week = 0; week <= weeks; week++) {
			let tr = H.tr()
			for (let weekday = 1; weekday <= 7; weekday++) {
				if (!week) {
					let th = H.th({class: 'calendar-day-th'}, weekday_name(weekday))
					tr.add(th)
				} else {
					let m = month(d)
					let s = d == today ? ' today' : ''
					s = s + (m == this_month ? ' current-month' : '')
					let td = H.td({class: 'calendar-day-td'+s}, floor(1 + days(d - m)))
					td.date = d
					td.on('click', day_click)
					tr.add(td)
					d = day(d, 1)
				}
			}
			table.add(tr)
		}
		return table
	}

	function day_click() {
		if (c.selected_td)
			c.selected_td.class('selected', false)
		this.class('selected', true)
		c.selected_td = this
	}

	function create_header(d) {
		let m = month_of(d)
		let y = year_of(d)
		let s1 = floor(1 + days(d - month(d)))
		let day_td = H.td({class: 'calendar-day'}, s1)
		let suffix_td = H.td({class: 'calendar-day-suffix'}, 'th')
		let s2 = month_name(m, 'long') + ' ' + y
		let month_td = H.td({class: 'calendar-month'}, s2)
		let tr = H.tr({}, day_td, suffix_td, month_td)
		return H.table({class: 'calendar-header-table'}, tr)
	}

	function create() {
		let d = day(now())
		c.header = create_header(d)
		c.weekview = create_weekview(d, 6)
		c.main = H.div({class: 'calendar'}, c.header, c.weekview)
		if (c.parent)
			c.parent.add(c.main)
	}

	init()

	return b

}

