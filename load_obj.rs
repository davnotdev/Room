//  Sorry, but I'm most comfortable in Rust :p.

fn main() {
    let arg = std::env::args().skip(1).next().unwrap();
    let obj = std::fs::read_to_string(arg).unwrap();
    let mut faces = vec![];
    let mut vertices = vec![];
    for line in obj.lines() {
        let split = line.split(' ').collect::<Vec<_>>();
        if split[0] == "v" {
            vertices.push([
                split[1].parse::<f32>().unwrap(),
                split[2].parse::<f32>().unwrap(),
                split[3].parse::<f32>().unwrap(),
            ]);
        } else if split[0] == "f" {
            faces.push([
                split[1].parse::<usize>().unwrap(),
                split[2].parse::<usize>().unwrap(),
                split[3].parse::<usize>().unwrap(),
            ]);
        }
    }

    let mut out = vec![];

    for face in faces.into_iter().flatten() {
        out.push(vertices[face - 1]);
    }

    eprintln!("{:?}", out.into_iter().flatten().collect::<Vec<_>>());
}
