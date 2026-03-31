import { isTraeCliInstalled } from '../utils';

export async function setup(args: string[]) {
    console.log('检查 trae-cli 状态...');
    const installed = await isTraeCliInstalled();

    if (installed) {
        console.log('✅ trae-cli 已安装并可用！');
    } else {
        console.log('❌ trae-cli 未安装或未在 PATH 中找到。');
        console.log('\n请按照以下步骤安装：');
        console.log('1. git clone https://github.com/bytedance/trae-agent.git');
        console.log('2. cd trae-agent');
        console.log('3. uv sync --all-extras');
        console.log('4. cp trae_config.yaml.example trae_config.yaml');
        console.log('5. 修改 trae_config.yaml 填入你的 API key');
        console.log('6. uv tool install .');
        console.log('\n安装完成后，再次运行 /trae:setup 验证。');
    }
}
