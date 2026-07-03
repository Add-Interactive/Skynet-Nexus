// newsroom/assets/js/sprite-animator.js
// Frame-based sprite animation system

class SpriteAnimator {
  constructor() {
    this.sprites = {};
  }
  
  // Register a sprite with animation frames
  registerSprite(id, frames) {
    this.sprites[id] = {
      id,
      frames, // { idle: [frame1, frame2, ...], researching: [...], etc. }
      currentState: 'idle',
      frameIndex: 0,
      frameTimer: 0,
      frameSpeed: 0.15 // seconds per frame
    };
  }
  
  // Set animation state for a sprite
  setState(id, state) {
    if (this.sprites[id]) {
      if (this.sprites[id].currentState !== state) {
        this.sprites[id].currentState = state;
        this.sprites[id].frameIndex = 0;
        this.sprites[id].frameTimer = 0;
      }
    }
  }
  
  // Update all sprites (call each animation frame)
  update(deltaTime = 16) {
    for (const id in this.sprites) {
      const sprite = this.sprites[id];
      sprite.frameTimer += deltaTime / 1000; // convert to seconds
      
      if (sprite.frameTimer >= sprite.frameSpeed) {
        sprite.frameTimer = 0;
        const currentFrames = sprite.frames[sprite.currentState] || sprite.frames['idle'];
        sprite.frameIndex = (sprite.frameIndex + 1) % currentFrames.length;
      }
    }
  }
  
  // Get current frame for a sprite
  getCurrentFrame(id) {
    if (!this.sprites[id]) return null;
    
    const sprite = this.sprites[id];
    const frames = sprite.frames[sprite.currentState] || sprite.frames['idle'];
    return frames[sprite.frameIndex];
  }
  
  // Get all sprite states
  getStates(id) {
    if (!this.sprites[id]) return [];
    return Object.keys(this.sprites[id].frames);
  }
}

// Helper: Generate placeholder sprite frames (as data URLs or canvas)
class PlaceholderSpriteGenerator {
  static generateCharacterFrames(color, animationState) {
    // Returns array of 4 canvas elements (32×32 each) representing animation frames
    const frames = [];
    
    for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      
      const ctx = canvas.getContext('2d');
      
      // Background
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(4, 8, 24, 16);
      
      // Head (simple circle-ish)
      ctx.fillStyle = color;
      ctx.globalAlpha = 1;
      ctx.fillRect(12, 4, 8, 6);
      
      // Legs (blink animation)
      const legOffset = frameIndex * 2;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(13, 26, 3, 4);
      ctx.fillRect(16, 26, 3, 4);
      
      // Animation indicator
      if (animationState === 'researching') {
        // Add thinking indicator
        ctx.fillStyle = '#00ccff';
        ctx.globalAlpha = 0.5 + (frameIndex / 4) * 0.5;
        ctx.fillRect(22, 6, 4, 4);
      } else if (animationState === 'writing') {
        // Add typing indicator
        ctx.fillStyle = '#ffff00';
        ctx.globalAlpha = frameIndex % 2 === 0 ? 1 : 0.3;
        ctx.fillRect(20, 14, 2, 2);
      } else if (animationState === 'filing') {
        // Add movement
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(8 + legOffset, 20, 3, 3);
      }
      
      frames.push(canvas);
    }
    
    return frames;
  }
  
  static generateAllAgents() {
    const agents = [
      { id: 'picard', name: 'Picard', color: '#00ccff' },
      { id: 'riker', name: 'Riker', color: '#00ccff' },
      { id: 'data', name: 'Data', color: '#ffff00' },
      { id: 'crusher', name: 'Crusher', color: '#ff6600' },
      { id: 'worf', name: 'Worf', color: '#ff0066' },
      { id: 'troi', name: 'Troi', color: '#00ff00' },
      { id: 'laforge', name: 'La Forge', color: '#ff9900' },
      { id: 'brahms', name: 'Brahms', color: '#00ccff' },
      { id: 'rolaren', name: 'Ro Laren', color: '#9900ff' },
      { id: 'wesley', name: 'Wesley', color: '#0066ff' },
      { id: 'guinan', name: 'Guinan', color: '#ff00ff' }
    ];
    
    const animationStates = ['idle', 'researching', 'writing', 'filing'];
    const spriteFrames = {};
    
    for (const agent of agents) {
      const frames = {};
      for (const state of animationStates) {
        frames[state] = PlaceholderSpriteGenerator.generateCharacterFrames(agent.color, state);
      }
      spriteFrames[agent.id] = frames;
    }
    
    return spriteFrames;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpriteAnimator, PlaceholderSpriteGenerator };
}
