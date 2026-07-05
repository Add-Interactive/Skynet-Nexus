// newsroom/assets/js/newsroom-state.js
// Manage newsroom state: agents, stories, queue, metrics

class NewsroomState {
  constructor() {
    this.agents = this.initializeAgents();
    this.queue = [];
    this.metrics = {
      filed: 0,
      published: 0,
      inQueue: 0,
      nextDrop: null,
      errors: 0
    };
    this.selectedStory = null;
    this.selectedAgent = null;
  }
  
  get apiPrefix() {
    return window.location.protocol === 'file:' ? 'http://localhost:4180' : '';
  }

  get fetchOptions() {
    return {
      credentials: window.location.protocol === 'file:' ? 'include' : 'same-origin'
    };
  }
  
  initializeAgents() {
    return [
      { id: 'picard', name: 'Dr. Sterling', channel: 'AI', emoji: '🧠', color: '#00ccff', gridX: 4, gridY: 0, status: 'idle', storiesCount: 0 },
      { id: 'riker', name: 'Cdr. Vance', channel: 'Space', emoji: '🚀', color: '#00ccff', gridX: 2, gridY: 2, status: 'idle', storiesCount: 0 },
      { id: 'data', name: 'Jax Henderson', channel: 'Robotics', emoji: '🤖', color: '#ffff00', gridX: 6, gridY: 2, status: 'idle', storiesCount: 0 },
      { id: 'crusher', name: 'Dr. Rivers', channel: 'Biotech', emoji: '🧬', color: '#ff6600', gridX: 1, gridY: 4, status: 'idle', storiesCount: 0 },
      { id: 'worf', name: 'Zephyr Thorne', channel: 'Quantum', emoji: '⚛️', color: '#ff0066', gridX: 7, gridY: 4, status: 'idle', storiesCount: 0 },
      { id: 'troi', name: 'Terra Green', channel: 'Climate', emoji: '🌍', color: '#00ff00', gridX: 0, gridY: 2, status: 'idle', storiesCount: 0 },
      { id: 'laforge', name: 'Mason Rivet', channel: 'Engineering', emoji: '🔧', color: '#ff9900', gridX: 8, gridY: 2, status: 'idle', storiesCount: 0 },
      { id: 'brahms', name: 'Adara Matrix', channel: 'Math', emoji: '📐', color: '#00ccff', gridX: 3, gridY: 4, status: 'idle', storiesCount: 0 },
      { id: 'rolaren', name: 'Cipher Crypt', channel: 'Cyber', emoji: '🔐', color: '#9900ff', gridX: 5, gridY: 4, status: 'idle', storiesCount: 0 },
      { id: 'wesley', name: 'Leo Pixel', channel: 'Gaming', emoji: '🎮', color: '#0066ff', gridX: 4, gridY: 5, status: 'idle', storiesCount: 0 },
      { id: 'guinan', name: 'Aria Harmony', channel: 'Music', emoji: '🎧', color: '#ff00ff', gridX: 2, gridY: 6, status: 'idle', storiesCount: 0 }
    ];
  }
  
  // Fetch queue from API
  async fetchQueue() {
    try {
      const response = await fetch(this.apiPrefix + '/api/admin/stories/queue', this.fetchOptions);
      if (!response.ok) throw new Error('Failed to fetch queue');
      
      const data = await response.json();
      this.queue = data.stories || data || [];
      this.updateMetrics();
      this.updateAgentStatus();
      return this.queue;
    } catch (e) {
      console.error('[NewsroomState] fetch queue failed:', e);
      return [];
    }
  }
  
  // Fetch metrics from API
  async fetchMetrics() {
    try {
      const response = await fetch(this.apiPrefix + '/api/admin/overview', this.fetchOptions);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      Object.assign(this.metrics, data);
      return data;
    } catch (e) {
      console.error('[NewsroomState] fetch metrics failed:', e);
      return {};
    }
  }
  
  updateMetrics() {
    this.metrics.inQueue = this.queue.length;
    this.metrics.filed = this.queue.filter(s => s.status === 'draft' || s.status === 'approved').length;
    this.metrics.published = this.queue.filter(s => s.status === 'published').length;
  }
  
  updateAgentStatus() {
    for (const agent of this.agents) {
      agent.storiesCount = this.queue.filter(s => s.channel === agent.channel).length;
      
      const agentStories = this.queue.filter(s => s.channel === agent.channel);
      if (agentStories.some(s => s.status === 'draft')) agent.status = 'writing';
      else if (agentStories.some(s => s.status === 'approved')) agent.status = 'filing';
      else if (agentStories.length > 0) agent.status = 'waiting';
      else agent.status = 'idle';
    }
  }
  
  getAgent(id) {
    return this.agents.find(a => a.id === id);
  }
  
  getStories(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent) return [];
    return this.queue.filter(s => s.channel === agent.channel);
  }
  
  selectStory(storyId) {
    this.selectedStory = this.queue.find(s => s.id === storyId);
    if (this.selectedStory) {
      this.selectedAgent = this.agents.find(a => a.channel === this.selectedStory.channel);
    }
    return this.selectedStory;
  }
  
  selectAgent(agentId) {
    this.selectedAgent = this.getAgent(agentId);
    return this.selectedAgent;
  }
  
  // Request revision from agent
  async requestRevision(storyId, notes) {
    try {
      const response = await fetch(this.apiPrefix + `/api/admin/stories/queue/${storyId}/request-revision`, {
        ...this.fetchOptions,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      
      if (!response.ok) throw new Error('Failed to request revision');
      
      const result = await response.json();
      const story = this.queue.find(s => s.id === storyId);
      if (story) story.status = 'revision_requested';
      
      return result;
    } catch (e) {
      console.error('[NewsroomState] request revision failed:', e);
      throw e;
    }
  }
  
  // Approve story
  async approveStory(storyId) {
    try {
      const response = await fetch(this.apiPrefix + `/api/admin/stories/queue/${storyId}`, {
        ...this.fetchOptions,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      
      if (!response.ok) throw new Error('Failed to approve story');
      
      const result = await response.json();
      const story = this.queue.find(s => s.id === storyId);
      if (story) story.status = 'approved';
      
      return result;
    } catch (e) {
      console.error('[NewsroomState] approve failed:', e);
      throw e;
    }
  }
  
  // Reject story
  async rejectStory(storyId) {
    try {
      const response = await fetch(this.apiPrefix + `/api/admin/stories/queue/${storyId}`, {
        ...this.fetchOptions,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      
      if (!response.ok) throw new Error('Failed to reject story');
      
      const result = await response.json();
      const story = this.queue.find(s => s.id === storyId);
      if (story) story.status = 'rejected';
      
      return result;
    } catch (e) {
      console.error('[NewsroomState] reject failed:', e);
      throw e;
    }
  }
  
  // Add image to story
  async addImage(storyId, imageUrl, altText, credit) {
    try {
      const response = await fetch(this.apiPrefix + `/api/admin/stories/queue/${storyId}/add-image`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, altText, credit })
      });
      
      if (!response.ok) throw new Error('Failed to add image');
      
      const result = await response.json();
      return result;
    } catch (e) {
      console.error('[NewsroomState] add image failed:', e);
      throw e;
    }
  }
  
  // Polling function
  async poll(interval = 5000) {
    setInterval(async () => {
      await this.fetchQueue();
      await this.fetchMetrics();
    }, interval);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewsroomState;
}
