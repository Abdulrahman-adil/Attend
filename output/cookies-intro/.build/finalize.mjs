import fs from 'node:fs/promises';
import path from 'node:path';
import {finalizePresentation} from '/Users/abdoadel/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations/container_tools/artifact_tool_utils.mjs';
const workspaceDir=path.resolve(import.meta.dirname,'..');
const skill='/Users/abdoadel/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations';
process.env.RUNTIME_NODE_MODULES='/Users/abdoadel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const result=await finalizePresentation({
 workspaceDir,
 candidatePath:path.join(import.meta.dirname,'candidate.pptx'),
 finalPath:path.join(workspaceDir,'files','Cookies-Intro.pptx'),
 pythonExecutable:'/Users/abdoadel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-bullet-geometry','--validate-heading-fit'],
 explicitTotalSlideCount:24,
 requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
 fontPolicy:{basis:'user_request',families:['.SF NS','.SF Arabic','.SF NS Mono']},
 verifyArtifactToolImport:true,
 receiptPath:path.join(import.meta.dirname,'validation.json')
});
console.log(JSON.stringify(result));
