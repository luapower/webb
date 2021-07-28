--[==[

	webb | mysql query function
	Written by Cosmin Apreutesei. Public Domain.

PREPROCESSOR

	sqlval(s) -> s                            quote string to SQL literal
	sqlname(s) -> s                           quote string to SQL identifier
	sqlparams(s, t) -> s                      quote query with ? and :name placeholders.
	sqlquery(s, t) -> s                       quote query with any preprocessor directives.
	sqlrows(rows[, opt]) -> s                 quote rows to SQL insert values list
	sql_default                               placeholder for default value
	sqlunquoted(s) -> f() -> s                generate an unquoted value to use in sqlrows()
	qsubst(typedef)                           create a substitution definition
	qmacro.<name> = f(args...)                create a macro definition

EXECUTION

	[p]query[_on]([ns,][opt,]sql, args...) -> res     query and return result table (compact)
	[p]kv_query[_on]([ns,][opt,]sql, args...) -> res  query and return result table (key-val)
	[p]query1[_on]([ns,][opt,]sql, args...) -> t      query and return first row
	[p]iquery[_on]([ns,][opt,]sql, args...) -> id     query and return insert id
	atomic(func)                                      execute func in transaction

RESULT PROCESSING

	changed(res) -> t|f                       check if any rows were updated
	groupby(col, res) -> t                    group rows by a column

DDL

	dbname([ns]) -> s                         database name based on app_codename
	allow_drop([t|f]) -> t|f                  control dropping of tables and fks
	create_database(name)                     create a database
	drop_table(name)                          drop table
	drop_tables('T1 T2 ...')                  drop multiple tables
	[re]add_fk(tbl, col, ...)                 (re)create a foreign key
	[re]add_uk(tbl, col)                      (re)create a unique key
	[re]add_ix(tbl, col)                      (re)create an index
	[re]add_trigger(name, tbl, on, code)      (re)create a trigger
	[re]add_column_locks(tbl, cols)           trigger to make columns read-only
	drop_fk(tbl, col)                         drop foreign key
	drop_uk(tbl, col)                         drop unique key
	drop_ix(tbl, col)                         drop index
	drop_trigger(name, tbl, on)               drop trigger
	add_column(tbl, name, type, pos)          add column
	rename_column(tbl, old_name, new_name)    rename column
	drop_column(tbl, col)                     remove column

DEBUGGING

	prq(rows, cols)                           pretty-print query result

]==]

require'webb'
local mysql = require'mysql_client'
local errors = require'errors'
local raise = errors.raise
local mysql_print = require'mysql_client_print'
local spp = require'sqlpp'.new()

spp.require'mysql'
spp.keywords[null] = 'null'
sql_default = spp.keyword.default
sqlval = spp.value
sqlrows = spp.rows
sqlname = spp.name
sqlparams = spp.params
sqlquery = spp.query
qsubst = spp.subst
qmacro = spp.macro

function sqlunquoted(s)
	return function() return s end
end

--db connection --------------------------------------------------------------

local function assertq(ret, ...)
	if ret ~= nil then
		return ret, ...
	end
	local err, errno, sqlstate = ...
	err = err:gsub('You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ', 'Syntax error: ')
	raise('db', {err = err, errno = errno, sqlstate = sqlstate, addtraceback = true},
		'%s%s%s', err,
			errno and ' ['..errno..']' or '',
			sqlstate and ' '..sqlstate or '')
end

local function pconfig(ns, k, default)
	if ns then
		return config(ns..'_'..k, config(k, default))
	else
		return config(k, default)
	end
end

local free_cns = {} --{ns->{cn->true}}

function dbname(ns)
	local default = assert(config('app_codename'))..(ns and '_'..ns or '')
	return pconfig(ns, 'db_schema', default)
end

local function connect(ns)
	ns = ns or false
	local cx = cx()
	local cn = attr(cx, 'cns')[ns]
	if not cn then
		local free_cns_ns = free_cns[ns]
		cn = free_cns_ns and next(free_cns_ns)
		if not cn then
			cn = assert(mysql:new())
			cx.cns[ns] = cn
			local t = {
				host     = pconfig(ns, 'db_host', '127.0.0.1'),
				port     = pconfig(ns, 'db_port', 3306),
				user     = pconfig(ns, 'db_user', 'root'),
				password = pconfig(ns, 'db_pass'),
				database = dbname(ns),
			}
			log('CONNECT', '%s:%s user=%s db=%s', t.host, t.port, t.user, t.database)
			assertq(cn:connect(t))
		else
			free_cns_ns[cn] = nil
			cx.cns[ns] = cn
		end
		on_cleanup(function()
			cx.cns[ns] = nil
			attr(free_cns, ns)[cn] = true
		end)
	end
	return cn
end

--query execution ------------------------------------------------------------

local function col_index(name, cols)
	for i,col in ipairs(cols) do
		if col.name == name then
			return i
		end
	end
end

local function process_result(t, cols, compact, opt)
	if cols and #cols == 1 and not (opt and opt.auto_array_result == false) then
		--single column result: return it as array
		local t0 = t
		t = {}
		local convert = opt and opt.convert_result and opt.convert_result[cols[1].name]
		if compact then
			for i,row in ipairs(t0) do
				local v = row[1]
				if convert then
					v = convert(v)
				end
				t[i] = v
			end
		else
			for i,row in ipairs(t0) do
				local k,v = next(row)
				if convert then
					v = convert(v)
				end
				t[i] = v
			end
		end
	elseif opt and opt.convert_result then
		for col, convert in pairs(opt.convert_result) do
			local fi = compact and assert(col_index(col, cols)) or col
			for _,row in ipairs(t) do
				row[fi] = convert(row[fi])
			end
		end
	end
	return t
end

local function run_query(compact, traceq, ns, opt, sql, ...)
	local t = ...
	if type(opt) == 'string' then --sql, ...
		sql, t = opt, sql
		opt = nil
		if type(t) ~= 'table' then
			t = {t, ...}
		end
	else --opt, sql, ...
		if type(t) ~= 'table' then
			t = {...}
		end
	end
	local cn = connect(ns)
	local sqls, params = spp.queries(sql, t)
	local t, cols, params, ts
	for sql_i, sql in ipairs(sqls) do
		ts = ts or (sql_i > 1 and {{t, cols, params}})
		local qtrace = traceq and trace('QUERY', '\n%s', glue.outdent(sql))
		assertq(cn:send_query(sql))
		t, err, cols = assertq(cn:read_result(nil, compact and 'compact'))
		t = process_result(t, cols, compact, opt)
		if err == 'again' then --multi-result/multi-statement query
			t = {t}
			repeat
				local t1, err = assertq(cn:read_result())
				t1 = process_result(t1, cols, compact)
				t[#t+1] = t1
			until not err
		end
		if qtrace then
			qtrace('QUERY', '%s', #t > 0 and 'rows: '..#t or pp.format(t))
		end
		if ts then add(ts, {t, cols, params}) end
	end
	if ts then
		return ts
	else
		return t, cols, params
	end
end

local function run_query1(...) --query first row (or first row/column) and close
	local rows, cols, params = run_query(...)
	local row = rows[1]
	if not row then return end
	if #cols == 1 then
		return row, params --row is actually the value
	end --first row/col
	return row, params --first row
end

local function run_iquery(...) --insert query: return the value of the auto_increment field.
	local t, cols, params = run_query(...)
	local id = t.insert_id
	return id ~= 0 and id or nil, params
end

function query_on     (...) return run_query  (true , false, ...) end
function pquery_on    (...) return run_query  (true , true , ...) end
function kv_query_on  (...) return run_query  (false, false, ...) end
function pkv_query_on (...) return run_query  (false, true , ...) end
function query1_on    (...) return run_query1 (false, false, ...) end
function pquery1_on   (...) return run_query1 (false, true , ...) end
function iquery_on    (...) return run_iquery (true , false, ...) end
function piquery_on   (...) return run_iquery (true , true , ...) end
function query        (...) return run_query  (true , false, nil, ...) end
function pquery       (...) return run_query  (true , true , nil, ...) end
function kv_query     (...) return run_query  (false, false, nil, ...) end
function pkv_query    (...) return run_query  (false, true , nil, ...) end
function query1       (...) return run_query1 (false, false, nil, ...) end
function pquery1      (...) return run_query1 (false, true , nil, ...) end
function iquery       (...) return run_iquery (true , false, nil, ...) end
function piquery      (...) return run_iquery (true , true , nil, ...) end

local function _atomic(query, func, ...)
	query'start transaction'
	local function pass(ok, ...)
		query(ok and 'commit' or 'rollback')
		assert(ok, err)
		return ...
	end
	return pass(glue.pcall(func, ...))
end

function  atomic(func, ...) return _atomic( query, func, ...) end
function patomic(func, ...) return _atomic(pquery, func, ...) end

--result processing ----------------------------------------------------------

function changed(res)
	return tonumber(res.message:match'Changed: (%d+)') > 0
end

function groupby(col, items)
	local t = {}
	if not col or not items then return t end
	local v
	local st
	local group_func = col
	if type(col) == 'string' or type(col) == 'number' then
		group_func = function(e) return e[col] end
	end
	for i,e in ipairs(items) do
		local v1 = group_func(e)
		if not st or v ~= v1 then
			st = {}
			t[#t+1] = st
		end
		st[#st+1] = e
		v = v1
	end
	return t
end

--ddl ------------------------------------------------------------------------

function allow_drop(on)
	if on ~= nil then
		spp.allow_drop = on
	else
		return spp.allow_drop
	end
end

update(_G, spp.command_api(pquery))

--debugging ------------------------------------------------------------------

function prq(rows, cols)
	return mysql_print.result(rows, cols)
end
