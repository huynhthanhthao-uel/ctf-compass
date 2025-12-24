# CTF Autopilot Sandbox Image
# Secure, isolated container for CTF challenge analysis
#
# Security features:
# - Non-root user execution
# - No network access (enforced at runtime)
# - Read-only filesystem (enforced at runtime)
# - Resource limits (enforced at runtime)

FROM ubuntu:24.04

LABEL maintainer="CTF Autopilot Team"
LABEL description="Secure sandbox for CTF challenge analysis"
LABEL version="1.0.0"

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install analysis tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Binary analysis
    binutils \
    binwalk \
    file \
    xxd \
    # Text processing
    strings \
    grep \
    sed \
    awk \
    # Document analysis
    poppler-utils \
    # Image/media analysis
    exiftool \
    imagemagick \
    # Network analysis
    tshark \
    tcpdump \
    # Archive handling
    unzip \
    p7zip-full \
    gzip \
    tar \
    # Scripting runtimes (read-only analysis)
    python3 \
    python3-pip \
    # Crypto tools
    openssl \
    # Hex editors
    hexedit \
    # Additional utilities
    jq \
    less \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Python analysis libraries
RUN pip3 install --no-cache-dir --break-system-packages \
    pycryptodome \
    pillow \
    pypdf2

# Create non-root user for sandbox execution
RUN groupadd -r sandbox && useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox

# Create working directories
RUN mkdir -p /sandbox/input /sandbox/output /sandbox/tmp \
    && chown -R sandbox:sandbox /sandbox

# Set working directory
WORKDIR /sandbox

# Switch to non-root user
USER sandbox

# Default command (overridden at runtime)
CMD ["/bin/bash"]
