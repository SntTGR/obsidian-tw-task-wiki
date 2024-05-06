/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type TWPlugin from './main';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as nt from 'neverthrow';

const asyncExec = promisify(exec);

export type Task = {
    uuid: string,
    status: TaskStatus
    data: Array<string>
};

type TaskStatus = 'P' | 'C' | 'D' | 'R'

export type Column = {
    type: string
    label: string
};

export type Report = {
    columns: Array<Column>, 
    tasks: Array<Task>,
    printedColumns: Array<Column>,
}

export enum TaskEvents {
    REFRESH = 'pending-refresh',
    INTERVAL = 'interval-fetch'
}

export default class TaskHandler {
    constructor(private readonly plugin: TWPlugin) {}
    
    async getTasks(clean_report: string, clean_command?: string) {

        const timestamp: number = Date.now();
        const result = await this.fetchReportTasks(clean_report, clean_command);
        if (result.isErr()) {
            this.plugin.logger!.error_log(result.error);
            throw nt.err(result.error);
        }

        return { report: result.value, timestamp };
    }

    createTask(command: string): nt.ResultAsync<string, Error> {
        return this.execTW(`add ${command}`)
            .map(v => this.parseCreationModificationOutput(v))
            .andThen(v => {
                if (v.length === 0) return nt.err(new Error('No task created'));
                if (v.length > 1) throw nt.err(new Error('Assertion failed: multiple tasks created'));
                return nt.ok(v[0]);
            })
            .andThen((v) => this.getUuidOfTask(v));
    }

    async modifyTask(uuid: string, command: string) {
        const result = await this.execTW(`${uuid} modify ${command}`);
        if (result.isErr()) return result;
        this.plugin.emitter!.emit(TaskEvents.REFRESH);
        return nt.ok(null);
    }
    
    async deleteTask(uuid: string) {
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

    private getUuidOfTask (id: string) {
        return this.execTW(['_get', `${id}.uuid`]).map( v => v.trim() );
    }

    private parseCreationModificationOutput (output: string): string[] {
        const lines = output.trim().split(/\n\r?/);
        return lines.map( l => /task (?<id>[0-9]+)/.exec(lines[0])?.groups?.id ).filter( v => v !== undefined && v !== null ) as string[];
    }

    private execTW = (args: string[] | string): nt.ResultAsync<string, Error> => {        
        let command = this.plugin.settings.tw_bin;
        if (Array.isArray(args)) command += ' ' + args.map( s => `"${s}"`).join(' ');
        else command += ' ' + args;
        
        this.plugin.logger!.debug_log('Executing: \n', command);
        return nt.ResultAsync.fromPromise(asyncExec(command).then( v => v.stdout ).then(r => { this.plugin.logger!.debug_log('Result: \n', r); return r }), (e) => e instanceof Error ? e : new Error(String(e)));
    }

    private fetchReportColumns = async (clean_report: string): Promise<nt.Result<Array<Column>, Error>> => {
    
        const label_commands = ['_get', `rc.report.${clean_report}.labels`];
        const column_commands = ['_get', `rc.report.${clean_report}.columns`];
    
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
        
    private fetchReportTasks = async (clean_report: string, clean_command?: string): Promise<nt.Result<Report, Error>> => {
        
        const cleanReportNoQuotes = clean_report.slice(1, clean_report.length - 1);

        const colRes = await this.fetchReportColumns(cleanReportNoQuotes);
        if (colRes.isErr()) { return nt.err(colRes.error); }
        const col = colRes.value;
        if (col.length === 0) return nt.ok({ columns: [], tasks: [], printedColumns: [] });
    
        // Call tasks overriding first two columns
        const colOverride = `rc.report.${cleanReportNoQuotes}.columns:${ ['uuid.long','status.short',...col.map( c => c.type )].join(',') }`
        const labOverride = `rc.report.${cleanReportNoQuotes}.labels:${ ['_tw_uuid', '_tw_status',...col.map( c => c.label )].join(',') }`
    
        const verbosityOverride = `rc.verbose:label`;
        const colorOverride = `rc.color:0` // ?
    
        const widthOverride = `rc.defaultwidth:0`
        const heightOverride = `rc.defaultheight:0`
    
        const rowPaddingOverride = `rc.row.padding:0`
        const columnPaddingOverride = `rc.column.padding:1`
    
        const hyphenateOverride = `rc.hyphenate:0`
        // const emptyColumnsOverride = `rc.print.empty.columns:0`
    
        const fullcommand : string = `${clean_report} ${clean_command ? clean_command + ' ' : ''}` + [colOverride, labOverride, verbosityOverride, colorOverride, widthOverride, heightOverride, rowPaddingOverride, columnPaddingOverride, hyphenateOverride].map(s => `"${s}"`).join(' ');

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
        const ocurrences = linearSearchOcurrence(' ', headerLine) // ranges [9,15,20]7
        
        const separatedLabels = sliceUsingSeparatorIndexes(labels, ocurrences).slice(2).map(l => l.trim());
        const printedColumns = separatedLabels.map( l => ({
            label: l,
            type: col.find( c => c.label === l )!.type
        })); // TODO: opt
        
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
            printedColumns: printedColumns
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









