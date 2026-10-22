'use strict';
const {spawnSync}=require('node:child_process');
for(const file of ['tests.js','ui-tests.js','regression-tests.js','feature-tools-tests.js','table-export-tests.js','studio-ui-tests.js','chart-tests.js']){
  const result=spawnSync(process.execPath,[file],{cwd:__dirname,stdio:'inherit'});
  if(result.status!==0){process.exitCode=result.status||1;break;}
}
