const fs = require('fs');
const path = require('path');

class FeatureRegistry {
    constructor() {
        this.features = new Map();
    }

    register(command, feature) {
        this.features.set(command, feature);
    }

    get(command) {
        return this.features.get(command);
    }

    getAll(ownerOnly = false) {
        return Array.from(this.features.entries())
            .filter(([_, feature]) => !ownerOnly || !feature.ownerOnly)
            .map(([cmd, feature]) => ({
                cmd,
                desc: feature.description,
                ownerOnly: feature.ownerOnly
            }));
    }

    getOwnerCommands() {
        return this.getAll().filter(f => f.ownerOnly);
    }

    getUserCommands() {
        return this.getAll().filter(f => !f.ownerOnly);
    }

    autoLoadFeatures(featuresDir) {
        const files = fs.readdirSync(featuresDir);
        
        for (const file of files) {
            if (file.endsWith('.js')) {
                try {
                    const FeatureClass = require(path.join(featuresDir, file));
                    const feature = new FeatureClass();
                    this.register(feature.name, feature);
                    
                    // Register aliases
                    if (feature.aliases && Array.isArray(feature.aliases)) {
                        for (const alias of feature.aliases) {
                            this.register(alias, feature);
                            console.log(`  ↳ Alias: ${alias}`);
                        }
                    }
                    
                    console.log(`✅ Loaded feature: ${feature.name}`);
                } catch (error) {
                    console.error(`❌ Failed to load ${file}:`, error.message);
                }
            }
        }
    }
}

module.exports = new FeatureRegistry();
