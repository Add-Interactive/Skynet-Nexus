// newsroom/assets/js/iso-renderer.js
// Isometric canvas renderer for the Star Trek / Final Fantasy II style bridge

class IsoRenderer {
  constructor(canvasId, width = 1200, height = 800) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = width;
    this.height = height;
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Isometric tile size
    this.tileWidth = 64;
    this.tileHeight = 32;
    
    // Depth sorting
    this.sprites = [];
    this.tiles = [];
  }
  
  // Convert grid coordinates to screen coordinates (isometric projection)
  gridToScreen(gridX, gridY, gridZ = 0) {
    const screenX = (gridX - gridY) * (this.tileWidth / 2);
    const screenY = (gridX + gridY) * (this.tileHeight / 2) - gridZ * 16;
    
    // Center in canvas
    const centerX = this.width / 2;
    const centerY = this.height / 3;
    
    return {
      x: centerX + screenX,
      y: centerY + screenY
    };
  }
  
  // Reverse: screen to grid
  screenToGrid(screenX, screenY) {
    const centerX = this.width / 2;
    const centerY = this.height / 3;
    
    const x = screenX - centerX;
    const y = screenY - centerY;
    
    const gridX = (x / (this.tileWidth / 2) + y / (this.tileHeight / 2)) / 2;
    const gridY = (y / (this.tileHeight / 2) - x / (this.tileWidth / 2)) / 2;
    
    return { gridX: Math.round(gridX), gridY: Math.round(gridY) };
  }
  
  // Add a sprite (agent or prop)
  addSprite(id, gridX, gridY, gridZ, spriteSheet, frameWidth, frameHeight) {
    this.sprites.push({
      id,
      gridX, gridY, gridZ,
      spriteSheet,
      frameWidth,
      frameHeight,
      currentFrame: 0,
      animationState: 'idle',
      animationSpeed: 0.1, // frames per tick
    });
  }
  
  // Update sprite animation
  updateSprite(id, state, speed = 0.1) {
    const sprite = this.sprites.find(s => s.id === id);
    if (sprite) {
      if (sprite.animationState !== state) {
        sprite.currentFrame = 0;
        sprite.animationState = state;
      }
      sprite.animationSpeed = speed;
    }
  }
  
  // Draw everything
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw scanlines
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < this.height; i += 2) {
      this.ctx.fillRect(0, i, this.width, 1);
    }
    
    // Draw bridge floor (simple isometric grid)
    this.drawFloor();
    
    // Sort sprites by depth (painter's algorithm)
    this.sprites.sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY));
    
    // Draw sprites
    for (const sprite of this.sprites) {
      this.drawSprite(sprite);
    }
  }
  
  drawFloor() {
    this.ctx.strokeStyle = '#00ff41';
    this.ctx.globalAlpha = 0.2;
    
    // Draw isometric grid
    for (let x = -5; x <= 15; x++) {
      for (let y = -5; y <= 15; y++) {
        const screen = this.gridToScreen(x, y);
        
        // Diamond outline
        const dx = this.tileWidth / 2;
        const dy = this.tileHeight / 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(screen.x - dx, screen.y);
        this.ctx.lineTo(screen.x, screen.y - dy);
        this.ctx.lineTo(screen.x + dx, screen.y);
        this.ctx.lineTo(screen.x, screen.y + dy);
        this.ctx.closePath();
        this.ctx.stroke();
      }
    }
    
    this.ctx.globalAlpha = 1;
  }
  
  drawSprite(sprite) {
    // For now, draw a placeholder 32×32 colored rectangle
    // Later: load actual sprite sheet and draw specific frame
    
    const screen = this.gridToScreen(sprite.gridX, sprite.gridY, sprite.gridZ);
    
    // Calculate frame number based on animation state and frame counter
    const totalFrames = 4; // 4 frames per animation
    const frame = Math.floor(sprite.currentFrame) % totalFrames;
    
    // Color based on animation state
    let color = '#00ff41'; // default: idle (green)
    if (sprite.animationState === 'researching') color = '#00ccff'; // cyan
    if (sprite.animationState === 'writing') color = '#ffff00'; // yellow
    if (sprite.animationState === 'filing') color = '#ff6600'; // orange
    if (sprite.animationState === 'approved') color = '#00ff00'; // bright green
    if (sprite.animationState === 'waiting') color = '#ff0066'; // pink
    
    // Draw character sprite (placeholder: 32×32 square with glow)
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 20;
    
    this.ctx.fillRect(screen.x - 16, screen.y - 16, 32, 32);
    
    this.ctx.shadowBlur = 0;
    
    // Draw animation progress (frame number at bottom)
    this.ctx.fillStyle = '#00ff41';
    this.ctx.font = '10px Orbitron';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(sprite.id.slice(0, 3).toUpperCase(), screen.x, screen.y + 28);
    
    // Advance animation frame
    sprite.currentFrame += sprite.animationSpeed;
  }
  
  tick() {
    // Called each frame for animation updates
    this.render();
  }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IsoRenderer;
}
