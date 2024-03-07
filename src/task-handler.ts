/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type TWPlugin from './main';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as nt from 'neverthrow';
import { Notice } from 'obsidian';

const asyncExec = promisify(exec);

export type Task = {
    uuid: string,
    status: TaskStatus
    data: Array<string>
};

type TaskStatus = 'Pending' | 'Completed' | 'Deleted' // Recurring?

export type Column = {
    type: string
    label: string
};

export type Report = {
    columns: Array<Column>, 
    tasks: Array<Task>,
    printedColumns: Array<string>,
}

export enum TaskEvents {
    REFRESH = 'pending-refresh',
    INTERVAL = 'interval-fetch'
}

export default class TaskHandler {
    constructor(private readonly plugin: TWPlugin) {}

    // Global memoization of reports
    private reports: Map<string, { report: Report, timestamp: number }> = new Map();
    
    async getTasks(report: string, command?: string) {
        // const memoizedReport = this.reports.get(report);
        // if (memoizedReport !== undefined) { 
        //     return memoizedReport.report;
        // }

        const timestamp: number = Date.now();
        const result = await this.fetchReportTasks(report, command);
        if (result.isErr()) {
            console.error(result.error);
            throw nt.err(result.error);
        }

        // const prevReport = this.reports.get(report);
        // if (prevReport !== undefined && prevReport.timestamp > timestamp) return prevReport;
        // this.reports.set(report, { report: result.value, timestamp })

        return { report: result.value, timestamp };
    }

    async createTask(command: string) {
        return this.execTW(`add ${command}`)
            .map(v => this.parseCreationModificationOutput(v))
            .andThen(v => {
                if (v.length === 0) return nt.err(new Error('No task created'));
                if (v.length > 1) throw nt.err(new Error('Assertion failed: multiple tasks created'));
                return nt.ok(v[0]);
            })
            .andThen(this.getUuidOfTask)
            .map(v => { this.notifyToUser(`Task ${v} created!`); return v;})
            .mapErr(e => { this.notifyToUser(`Error creating task: ${e.message}`, true); return e; });
    }

    async modifyTask(uuid: string, command: string) {
        const result = await this.execTW(`${uuid} modify ${command}`);
        if (result.isErr()) return result;
        this.plugin.emitter!.emit(TaskEvents.REFRESH);
        return nt.ok(null);
    }
    
    async deleteTask(uuid: string) {
        // NOTE: might need to overload the confirmation
        const result = await this.setTaskStatus(uuid, 'deleted');
        if (result.isErr()) return result;
        this.plugin.emitter!.emit(TaskEvents.REFRESH);
    }
    
    async completeTask(uuid: string) {
        const result = await this.execTW([uuid, 'done']);
        if (result.isErr()) return result;
        this.plugin.emitter!.emit(TaskEvents.REFRESH);
    }
    
    async undoTask(uuid: string) {
        this.setTaskStatus(uuid, 'pending');
        this.plugin.emitter!.emit(TaskEvents.REFRESH);
    }

    invalidateCache = () => {
        this.reports.clear();
    }

    private notifyToUser (message: string, error = false) {
        new Notice(error ? 'Error ' : '' + message, 5000);
    }
    
    private getUuidOfTask (id: string) {
        return this.execTW(['_get', `${id}.uuid`]);
        
    }

    private parseCreationModificationOutput (output: string): string[] {
        const lines = output.trim().split('\n');
        return lines.map( l => /task (?<id>[0-9]+)/.exec(lines[0])?.groups?.id ).filter( v => v !== undefined ) as string[];
    }

    private execTW = (args: string[] | string): nt.ResultAsync<string, Error> => {
        // TODO: better exec handling
        
        let command = this.plugin.settings.path;
        if (Array.isArray(args)) command += ' ' + args.map( s => `"${s}"`).join(' ');
        else command += ' ' + args;
        
        console.log('Executing: \n', command);
        return nt.ResultAsync.fromPromise(asyncExec(command).then( v => v.stdout ).then(r => { console.log('Result: \n', r); return r }), (e) => e instanceof Error ? e : new Error(String(e)));
    }

    private fetchReportColumns = async (report: string): Promise<nt.Result<Array<Column>, Error>> => {
    
        const rep = report;
    
        const label_commands = ['_get', `rc.report.${rep}.labels`];
        const column_commands = ['_get', `rc.report.${rep}.columns`];
    
        const [labels, columns] = await Promise.all(
            [
                this.execTW(label_commands).then(r => r.map( s => s.trim().split(',') )),
                this.execTW(column_commands).then(r => r.map( s => s.trim().split(',') ))
            ]
        ) as [nt.Result<string[], Error>, nt.Result<string[], Error>]
    
        if (labels.isErr() || columns.isErr() ) {
            return nt.errAsync(new Error('Error trying to get columns/labels for report'));
        }
    
        const cols = columns.value.filter(p => p.trim() !== '').map( (col, i) => ({ label: labels.value[i], type: col }) )
    
        return nt.ok(cols);
    }
    
        // TODO: memoize reports from a function here. Expose that function to the taskHandler
    
    private fetchReportTasks = async (report: string, command?: string): Promise<nt.Result<Report, Error>> => {
        
        const colRes = await this.fetchReportColumns(report);
        if (colRes.isErr()) { return nt.err(colRes.error); }
        const col = colRes.value;
        if (col.length === 0) return nt.ok({ columns: [], tasks: [], printedColumns: [] });
    
        // Call tasks overriding first two columns
        const colOverride = `rc.report.${report}.columns:${ ['uuid.long','status.long',...col.map( c => c.type )].join(',') }`
        const labOverride = `rc.report.${report}.labels:${ ['_tw_uuid', '_tw_status',...col.map( c => c.label )].join(',') }`
    
        const verbosityOverride = `rc.verbose:label`;
        const colorOverride = `rc.color:0` // ?
    
        const widthOverride = `rc.defaultwidth:0`
        const heightOverride = `rc.defaultheight:0`
    
        const rowPaddingOverride = `rc.row.padding:0`
        const columnPaddingOverride = `rc.column.padding:1`
    
        const hyphenateOverride = `rc.hyphenate:0`
    
        // const emptyColumnsOverride = `rc.print.empty.columns:0`
    
        // Separate using the label's line separator
    
        console.log('command', command);
        const fullcommand : string = `${report} ${command ? command + ' ' : ''}` + [colOverride, labOverride, verbosityOverride, colorOverride, widthOverride, heightOverride, rowPaddingOverride, columnPaddingOverride, hyphenateOverride].map(s => `"${s}"`).join(' ');

        console.log(fullcommand);

        const twRes = await this.execTW(fullcommand);
        if (twRes.isErr()) { 
            // Means that no matches were found
            return nt.ok({ columns: col, tasks: [], printedColumns: [] })
        }
    
        const tw = twRes.value;
    
        // Get char start/endings based on headerLine
    
        // try to parse columns in report
        
        // __tw_uuid label1 label2       label3
        // --------- ------ ------------ ------
        // uuid1     dat    may be empty 
        //                  extra
        // uuid2     dat2   description  true
        
        const [labels, headerLine, ...taskLines] = tw.split('\n');
        const ocurrences = linearSearchOcurrence(' ', headerLine) // ranges [9,15,20]
        
        const separatedLabels = sliceUsingSeparatorIndexes(labels, ocurrences).slice(2).map(l => l.trim());
        const taskList: Task[] = [];
        
        for (let i = 0; i < taskLines.length; i++) {
            const taskLine = taskLines[i];
            const [rawUuid, rawStatus, ...rawData] = sliceUsingSeparatorIndexes(taskLine, ocurrences)
        
            const uuid = rawUuid.trim();
            if(uuid === '') {
                // Handle multiline task descriptions
                const prevTask = taskList[taskList.length - 1];
    
                rawData.forEach( (v, i, rawData) => {
                    const indData = rawData[i].trim();
                    if (indData === '') return;
                    prevTask.data[i] += `\n\t${indData}`;
                })
    
                continue;
            }
        
            taskList.push({
                uuid: uuid,
                status: rawStatus.trim() as TaskStatus,
    
                data: rawData.map( d => d.trim() )
            });
        }
    
        return nt.ok({
            tasks: taskList,
            columns: col,
            printedColumns: separatedLabels
        });
    }
    
    private setTaskStatus = async (uuid: string, status: 'completed' | 'pending' | 'deleted'): Promise<nt.Result<void, Error>> => {
        return this.execTW([uuid, 'modify', `status:${status}`]).map( (t) => {} );
    }
}

function linearSearchOcurrence (search: string, array: string): number[] {
    const indices: number[] = [];
    for (let i = 0; i < array.length; i++) {
        if (array[i] === search) indices.push(i);
    }
    indices.push(array.length);
    return indices;
}

function sliceUsingSeparatorIndexes (input: string, indexes: number[]): string[] {
    const result: string[] = [];
    let prevOcurrence = 0;
    for (let i = 0; i < indexes.length; i++) {
        result.push(input.slice(prevOcurrence, indexes[i]));
        prevOcurrence = indexes[i];
    }
    return result;
}









