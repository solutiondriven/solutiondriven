/**
 * ServiceDiscovery
 * 
 * Kubernetes-native service discovery with:
 * 1. Automatic service endpoint resolution via DNS
 * 2. Health-aware load balancing
 * 3. Circuit breaker integration
 * 4. Service mesh observability hooks
 */

const dns = require('dns').promises;

class ServiceDiscovery {
  constructor(kubernetesCluster = {}) {
    this.cluster = {
      namespace: 'micromax',
      domain: process.env.K8S_DOMAIN || 'svc.cluster.local',
      ...kubernetesCluster
    };

    this.serviceCache = new Map();
    this.cacheExpiry = 30000; // 30 seconds
  }

  /**
   * Resolve a service endpoint to its IP addresses
   * 
   * In Kubernetes, each service gets a DNS name:
   * <service>.<namespace>.svc.cluster.local
   * 
   * Example: strategy-service.micromax.svc.cluster.local
   */
  async resolveService(serviceName) {
    const fqdn = `${serviceName}.${this.cluster.namespace}.${this.cluster.domain}`;
    
    // Check cache first
    const cached = this.getCache(fqdn);
    if (cached) {
      return cached;
    }

    try {
      // Use Kubernetes DNS to resolve service
      const addresses = await dns.resolve4(fqdn);
      
      const endpoints = addresses.map(ip => ({
        ip,
        host: fqdn,
        port: 8000, // Default service port
        healthy: true
      }));

      this.setCache(fqdn, endpoints);
      return endpoints;
    } catch (error) {
      console.error(`Failed to resolve service ${fqdn}:`, error.message);
      
      // Return cached result if resolution fails
      const staleCache = this.serviceCache.get(fqdn);
      if (staleCache) {
        console.warn(`Using stale cache for ${fqdn}`);
        return staleCache.endpoints;
      }

      throw new Error(`Cannot resolve service: ${serviceName}`);
    }
  }

  /**
   * Select an endpoint from resolved service using round-robin
   * Healthier endpoints are weighted higher
   */
  selectEndpoint(endpoints) {
    if (!endpoints || endpoints.length === 0) {
      throw new Error('No endpoints available');
    }

    // Filter healthy endpoints
    const healthyEndpoints = endpoints.filter(ep => ep.healthy);
    
    if (healthyEndpoints.length === 0) {
      console.warn('⚠️ No healthy endpoints available, using unhealthy endpoints');
      return endpoints[Math.floor(Math.random() * endpoints.length)];
    }

    // Round-robin selection
    const index = Math.floor(Math.random() * healthyEndpoints.length);
    return healthyEndpoints[index];
  }

  /**
   * Get service mesh configuration for a service
   * (VirtualService, DestinationRule, etc.)
   */
  getServiceMeshConfig(serviceName) {
    return {
      serviceName,
      namespace: this.cluster.namespace,
      // Istio Virtual Service configuration
      virtualService: {
        apiVersion: 'networking.istio.io/v1beta1',
        kind: 'VirtualService',
        metadata: {
          name: serviceName
        },
        spec: {
          hosts: [`${serviceName}.${this.cluster.namespace}.svc.cluster.local`],
          http: [
            {
              match: [{ uri: { prefix: '/api/v1/' } }],
              route: [
                {
                  destination: {
                    host: `${serviceName}.${this.cluster.namespace}.svc.cluster.local`,
                    port: { number: 8000 }
                  },
                  weight: 100
                }
              ],
              timeout: '5s',
              retries: {
                attempts: 3,
                perTryTimeout: '1s'
              }
            }
          ]
        }
      },
      // Istio Destination Rule configuration (circuit breaker, load balancing)
      destinationRule: {
        apiVersion: 'networking.istio.io/v1beta1',
        kind: 'DestinationRule',
        metadata: {
          name: serviceName
        },
        spec: {
          host: `${serviceName}.${this.cluster.namespace}.svc.cluster.local`,
          trafficPolicy: {
            connectionPool: {
              tcp: { maxConnections: 100 },
              http: {
                http1MaxPendingRequests: 100,
                http2MaxRequests: 1000,
                maxRequestsPerConnection: 2
              }
            },
            outlierDetection: {
              consecutive5xxErrors: 5,
              interval: '30s',
              baseEjectionTime: '30s',
              maxEjectionPercent: 100,
              minRequestVolume: 5
            },
            loadBalancer: {
              simple: 'LEAST_REQUEST'
            }
          },
          subsets: [
            {
              name: 'v1',
              labels: { version: 'v1' }
            }
          ]
        }
      }
    };
  }

  /**
   * Get authorization policy for service-to-service communication
   * (Enforces zero-trust model)
   */
  getAuthorizationPolicy(serviceName, allowedCallers) {
    return {
      apiVersion: 'security.istio.io/v1beta1',
      kind: 'AuthorizationPolicy',
      metadata: {
        name: `${serviceName}-authz`,
        namespace: this.cluster.namespace
      },
      spec: {
        selector: {
          matchLabels: { app: serviceName }
        },
        rules: allowedCallers.map(caller => ({
          from: [
            {
              source: {
                principals: [
                  `cluster.local/ns/${this.cluster.namespace}/sa/${caller}`
                ]
              }
            }
          ],
          to: [
            {
              operation: {
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                paths: [`/api/v1/*`]
              }
            }
          ]
        }))
      }
    };
  }

  /**
   * Mark endpoint as unhealthy (triggered by circuit breaker)
   */
  markEndpointUnhealthy(serviceName, ip) {
    const fqdn = `${serviceName}.${this.cluster.namespace}.${this.cluster.domain}`;
    const endpoints = this.serviceCache.get(fqdn);
    
    if (endpoints) {
      const endpoint = endpoints.endpoints.find(ep => ep.ip === ip);
      if (endpoint) {
        endpoint.healthy = false;
        console.log(`⚠️ Marked ${ip} as unhealthy`);
      }
    }
  }

  /**
   * Mark endpoint as healthy again
   */
  markEndpointHealthy(serviceName, ip) {
    const fqdn = `${serviceName}.${this.cluster.namespace}.${this.cluster.domain}`;
    const endpoints = this.serviceCache.get(fqdn);
    
    if (endpoints) {
      const endpoint = endpoints.endpoints.find(ep => ep.ip === ip);
      if (endpoint) {
        endpoint.healthy = true;
        console.log(`✅ Marked ${ip} as healthy`);
      }
    }
  }

  /**
   * Cache management
   */
  getCache(fqdn) {
    const cached = this.serviceCache.get(fqdn);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.endpoints;
    }
    return null;
  }

  setCache(fqdn, endpoints) {
    this.serviceCache.set(fqdn, {
      endpoints,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache for a service (useful after configuration changes)
   */
  clearServiceCache(serviceName) {
    const fqdn = `${serviceName}.${this.cluster.namespace}.${this.cluster.domain}`;
    this.serviceCache.delete(fqdn);
    console.log(`Cache cleared for ${serviceName}`);
  }

  /**
   * Get all cached services
   */
  getCachedServices() {
    return Array.from(this.serviceCache.keys());
  }
}

module.exports = ServiceDiscovery;
