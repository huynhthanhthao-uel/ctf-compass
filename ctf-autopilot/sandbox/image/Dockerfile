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

# Install analysis tools for CTF challenges
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Binary analysis (binutils includes strings, objdump, nm, readelf, size, etc.)
    binutils \
    binwalk \
    file \
    elfutils \
    # Hex/Binary viewing
    xxd \
    bsdmainutils \
    # Text processing
    gawk \
    grep \
    sed \
    coreutils \
    # Document analysis (poppler-utils includes pdfinfo, pdftotext, pdfimages)
    poppler-utils \
    pdftk-java \
    # Image/media analysis & steganography
    libimage-exiftool-perl \
    imagemagick \
    steghide \
    foremost \
    # Network analysis
    tshark \
    tcpdump \
    ssldump \
    # Archive handling
    unzip \
    p7zip-full \
    gzip \
    bzip2 \
    xz-utils \
    tar \
    unrar \
    cabextract \
    # Scripting runtimes
    python3 \
    python3-pip \
    python3-venv \
    # Crypto tools
    openssl \
    john \
    hashcat \
    # Hex editors
    hexedit \
    # QR/Barcode
    zbar-tools \
    # Audio/Video analysis
    sox \
    ffmpeg \
    # Memory/Disk forensics
    testdisk \
    # Reverse engineering
    radare2 \
    # Debugging tools
    gdb \
    ltrace \
    strace \
    # Additional utilities
    jq \
    less \
    ca-certificates \
    netcat-openbsd \
    curl \
    wget \
    libxml2-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Python analysis libraries
RUN pip3 install --no-cache-dir --break-system-packages \
    pycryptodome \
    pillow \
    pypdf2 \
    pwntools \
    angr \
    z3-solver \
    capstone \
    keystone-engine \
    unicorn \
    ropper \
    zsteg \
    stegcracker \
    name-that-hash \
    search-that-hash \
    fcrackzip

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
