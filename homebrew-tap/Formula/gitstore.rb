class Gitstore < Formula
  desc "App store for GitHub — install and run repos as applications"
  homepage "https://svetimfm.github.io/GitStore/"
  url "https://registry.npmjs.org/gitstore/-/gitstore-0.3.0.tgz"
  license "PolyForm-Noncommercial-1.0.0"

  depends_on "node@18"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "0.3.0", shell_output("#{bin}/gitstore --version")
  end
end
