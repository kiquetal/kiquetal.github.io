workspace "Istio External Authorization" "Architecture model for fine-grained authorization with external middleware and Istio Envoy sidecars" {

    !identifiers hierarchical

    model {
        u = person "Client" "A user or application making API requests"
        
        mesh = softwareSystem "Service Mesh System" "Handles application routing, interception, and policy-based security" {
            gateway = container "API Gateway" "Acts as entry router and logical target service stamper" "KrakenD"
            
            group "Target Service Pod (K8s Pod Boundary)" {
                sidecar = container "Envoy Sidecar" "Inbound sidecar proxy intercepting network traffic" "Envoy Proxy"
                backend = container "Business Microservice" "Core application container executing business logic" "Quarkus / Go"
            }
            
            middleware = container "Auth Middleware" "Evaluates tokens and access rules dynamically" "Go Service"
        }

        u -> mesh.gateway "Sends API Request" "HTTPS"
        mesh.gateway -> mesh.sidecar "Routes request to microservice pod" "HTTP"
        
        # Interception Loop
        mesh.sidecar -> mesh.middleware "Delegates external authorization check (/check)" "HTTP/gRPC"
        mesh.middleware -> mesh.sidecar "Returns ALLOW (200 OK) / DENY status" "HTTP/gRPC"
        
        # Local delivery after successful interception
        mesh.sidecar -> mesh.backend "Forwards authorized request locally" "Localhost (Loopback)"
    }

    views {
        container mesh "IstioExtAuthz" "Container diagram for Istio External Authorization flow" {
            include *
            autoLayout lr
        }

        styles {
            element "Element" {
                color #ffffff
                background #0773af
                stroke #055a87
                strokeWidth 2
                shape roundedbox
            }
            element "Person" {
                shape person
                background #112b3c
            }
            element "Group" {
                color #5C4A3A
                stroke #8B7355
                strokeWidth 2
            }
            relationship "Relationship" {
                color #2c3e50
                thickness 2
            }
        }
    }

    configuration {
        scope softwaresystem
    }

}
