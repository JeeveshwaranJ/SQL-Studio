const { Client } = require("@gradio/client");

async function run() {
  try {
    const client = await Client.connect("jeeves111/my-ai-chatbot");
    const dep = client.config.dependencies.find(d => d.id === 7 || d.api_name === "respond");
    console.log("=== DEPENDENCY ===");
    console.log(JSON.stringify(dep, null, 2));
    
    console.log("=== INPUT COMPONENTS ===");
    dep.inputs.forEach(id => {
      const comp = client.config.components.find(c => c.id === id);
      console.log(`ID: ${id}, Type: ${comp ? comp.type : 'Unknown'}, Props:`, comp ? comp.props : {});
    });
  } catch (err) {
    console.error(err);
  }
}

run();
