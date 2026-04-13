#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const setup_1 = require("./commands/setup");
const review_1 = require("./commands/review");
const run_1 = require("./commands/run");
const jobs_1 = require("./commands/jobs");
const hooks_1 = require("./commands/hooks");
const rescue_1 = require("./commands/rescue");
const sessions_1 = require("./commands/sessions");
const acp_1 = require("./commands/acp");
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const cmdArgs = args.slice(1);
    if (!command) {
        console.log('用法: trae <command> [args]');
        console.log('命令: setup, review, adversarial-review, run, status, result, cancel, sessions, acp');
        process.exit(1);
    }
    try {
        switch (command) {
            case 'setup':
                await (0, setup_1.setup)(cmdArgs);
                break;
            case 'review':
                await (0, review_1.review)(cmdArgs, false);
                break;
            case 'adversarial-review':
                await (0, review_1.review)(cmdArgs, true);
                break;
            case 'run':
                await (0, run_1.runTask)(cmdArgs);
                break;
            case 'status':
                (0, jobs_1.status)(cmdArgs);
                break;
            case 'result':
                (0, jobs_1.result)(cmdArgs);
                break;
            case 'cancel':
                (0, jobs_1.cancel)(cmdArgs);
                break;
            case 'hooks':
                await (0, hooks_1.handleHook)(cmdArgs);
                break;
            case 'rescue':
                await (0, rescue_1.rescue)(cmdArgs);
                break;
            case 'sessions':
                await (0, sessions_1.sessions)(cmdArgs);
                break;
            case 'acp':
                await (0, acp_1.acp)(cmdArgs);
                break;
            default:
                console.log(`未知命令: ${command}`);
                console.log('可用命令: setup, review, adversarial-review, run, status, result, cancel, sessions, acp');
                process.exit(1);
        }
    }
    catch (error) {
        console.error('执行失败:', error.message);
        process.exit(1);
    }
}
main();
